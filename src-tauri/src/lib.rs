use tauri_plugin_sql::{Migration, MigrationKind};

mod album;
mod commands;
mod image;

pub(crate) const DATABASE_URL: &str = "sqlite:photo-note.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create album groups, photos, and drafts",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add photo thumbnail path",
            sql: include_str!("../migrations/002_add_thumbnail_path.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_camera_kessdev::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            album::create_album_group,
            album::list_album_groups,
            commands::call_ccswitch_llm,
            image::store_image_from_path,
            image::store_image_from_data_url,
            image::remove_imported_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
