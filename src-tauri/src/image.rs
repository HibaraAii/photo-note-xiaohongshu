use std::{
    fs,
    io::Cursor,
    path::{Component, Path, PathBuf},
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::{ImageFormat, ImageReader};
use serde::Serialize;
use tauri::{AppHandle, Manager};

const DEFAULT_THUMBNAIL_SIZE: u32 = 480;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredImage {
    file_path: String,
    thumbnail_path: String,
    file_name: String,
    mime_type: String,
    width: u32,
    height: u32,
}

#[tauri::command]
pub async fn store_image_from_path(
    app: AppHandle,
    asset_id: String,
    group_id: String,
    source_path: String,
    file_name: Option<String>,
    thumbnail_size: Option<u32>,
) -> Result<StoredImage, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let source = Path::new(&source_path);
        let bytes = fs::read(source).map_err(|error| error.to_string())?;
        let original_name = file_name
            .or_else(|| {
                source
                    .file_name()
                    .map(|value| value.to_string_lossy().into_owned())
            })
            .unwrap_or_else(|| format!("image-{asset_id}"));

        store_image_bytes(
            &app_data_dir,
            &asset_id,
            &group_id,
            &original_name,
            bytes,
            thumbnail_size,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn store_image_from_data_url(
    app: AppHandle,
    asset_id: String,
    group_id: String,
    data_url: String,
    file_name: Option<String>,
    thumbnail_size: Option<u32>,
) -> Result<StoredImage, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let (metadata, encoded) = data_url
            .split_once(',')
            .ok_or_else(|| "Invalid image data URL.".to_string())?;

        if !metadata.ends_with(";base64") {
            return Err("Image data URL must be base64 encoded.".to_string());
        }

        let bytes = STANDARD
            .decode(encoded.trim())
            .map_err(|error| error.to_string())?;
        let original_name = file_name.unwrap_or_else(|| format!("camera-{asset_id}"));

        store_image_bytes(
            &app_data_dir,
            &asset_id,
            &group_id,
            &original_name,
            bytes,
            thumbnail_size,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn remove_imported_images(app: AppHandle, relative_paths: Vec<String>) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    for relative_path in relative_paths {
        let path = resolve_app_relative_path(&app_data_dir, &relative_path)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn store_image_bytes(
    app_data_dir: &Path,
    asset_id: &str,
    group_id: &str,
    original_name: &str,
    bytes: Vec<u8>,
    thumbnail_size: Option<u32>,
) -> Result<StoredImage, String> {
    let reader = ImageReader::new(Cursor::new(bytes.as_slice()))
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    let format = reader
        .format()
        .ok_or_else(|| "Unsupported or unknown image format.".to_string())?;
    let decoded = reader.decode().map_err(|error| error.to_string())?;

    let extension = extension_for_format(format)?;
    let mime_type = mime_type_for_format(format)?;
    let group_segment = sanitize_segment(group_id);
    let asset_segment = sanitize_segment(asset_id);
    let file_name = Path::new(original_name)
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("{asset_segment}.{extension}"));

    let photos_dir = app_data_dir.join("photos").join(&group_segment);
    let thumbnails_dir = app_data_dir.join("thumbnails").join(&group_segment);
    fs::create_dir_all(&photos_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&thumbnails_dir).map_err(|error| error.to_string())?;

    let stored_file_name = format!("{asset_segment}.{extension}");
    let thumbnail_file_name = format!("{asset_segment}.png");
    let image_path = photos_dir.join(&stored_file_name);
    let thumbnail_path = thumbnails_dir.join(&thumbnail_file_name);

    fs::write(&image_path, &bytes).map_err(|error| error.to_string())?;

    let size = thumbnail_size
        .unwrap_or(DEFAULT_THUMBNAIL_SIZE)
        .clamp(64, 1024);
    let thumbnail = decoded.thumbnail(size, size);

    if let Err(error) = thumbnail.save_with_format(&thumbnail_path, ImageFormat::Png) {
        let _ = fs::remove_file(&image_path);
        return Err(error.to_string());
    }

    Ok(StoredImage {
        file_path: format!("photos/{group_segment}/{stored_file_name}"),
        thumbnail_path: format!("thumbnails/{group_segment}/{thumbnail_file_name}"),
        file_name,
        mime_type: mime_type.to_string(),
        width: decoded.width(),
        height: decoded.height(),
    })
}

fn resolve_app_relative_path(app_data_dir: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    let is_safe = !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_) | Component::CurDir));

    if !is_safe {
        return Err("Invalid application-relative image path.".to_string());
    }

    Ok(app_data_dir.join(path))
}

fn sanitize_segment(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .take(120)
        .collect();

    if sanitized.is_empty() {
        "unknown".to_string()
    } else {
        sanitized
    }
}

fn extension_for_format(format: ImageFormat) -> Result<&'static str, String> {
    match format {
        ImageFormat::Jpeg => Ok("jpg"),
        ImageFormat::Png => Ok("png"),
        ImageFormat::WebP => Ok("webp"),
        ImageFormat::Gif => Ok("gif"),
        ImageFormat::Bmp => Ok("bmp"),
        ImageFormat::Tiff => Ok("tiff"),
        _ => Err("Unsupported image format.".to_string()),
    }
}

fn mime_type_for_format(format: ImageFormat) -> Result<&'static str, String> {
    match format {
        ImageFormat::Jpeg => Ok("image/jpeg"),
        ImageFormat::Png => Ok("image/png"),
        ImageFormat::WebP => Ok("image/webp"),
        ImageFormat::Gif => Ok("image/gif"),
        ImageFormat::Bmp => Ok("image/bmp"),
        ImageFormat::Tiff => Ok("image/tiff"),
        _ => Err("Unsupported image format.".to_string()),
    }
}
