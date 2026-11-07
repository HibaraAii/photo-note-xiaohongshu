import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  capture,
  checkPermissions,
  requestPermissions,
  startPreview,
  stopPreview,
} from "tauri-plugin-camera-kessdev";
import { addPhoto } from "@/lib/db";
import type { Photo } from "@/types/database";
import type {
  CameraCaptureOptions,
  CameraPreviewOptions,
  ImageImportOptions,
} from "@/types/image";

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
];

interface StoredImage {
  filePath: string;
  thumbnailPath: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
}

export async function selectImageFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: IMAGE_EXTENSIONS,
      },
    ],
  });

  if (!selected) {
    return [];
  }

  return Array.isArray(selected) ? selected : [selected];
}

export async function importSelectedImagesToAlbum(
  groupId: string,
  options: ImageImportOptions = {},
): Promise<Photo[]> {
  const paths = await selectImageFiles();
  return importImagePathsToAlbum(groupId, paths, options);
}

export async function importImagePathsToAlbum(
  groupId: string,
  sourcePaths: string[],
  options: ImageImportOptions = {},
): Promise<Photo[]> {
  const photos: Photo[] = [];
  const sortOrderStart = options.sortOrderStart ?? 0;

  for (const [index, sourcePath] of sourcePaths.entries()) {
    const assetId = createId();
    const stored = await invoke<StoredImage>("store_image_from_path", {
      assetId,
      groupId,
      sourcePath,
      thumbnailSize: options.thumbnailSize,
    });

    photos.push(
      await persistStoredImage(
        groupId,
        assetId,
        stored,
        sortOrderStart + index,
      ),
    );
  }

  return photos;
}

export async function startCameraPreview(
  options: CameraPreviewOptions = {},
): Promise<void> {
  await ensureCameraPermission();
  await startPreview({
    camera: options.camera ?? "back",
    windowed: options.windowed,
  });
}

export async function stopCameraPreview(): Promise<void> {
  await stopPreview();
}

export async function captureCameraPhotoToAlbum(
  groupId: string,
  options: CameraCaptureOptions = {},
): Promise<Photo> {
  const managePreview = options.managePreview ?? true;

  if (managePreview) {
    await startCameraPreview(options);
  } else {
    await ensureCameraPermission();
  }

  try {
    const captured = await capture({
      flash: options.flash ?? "auto",
      format: options.format ?? "jpeg",
      quality: options.quality ?? 0.9,
      resolution: options.resolution,
      aspectRatio: options.aspectRatio,
    });
    const assetId = createId();

    if (captured.path) {
      const stored = await invoke<StoredImage>("store_image_from_path", {
        assetId,
        groupId,
        sourcePath: captured.path,
        fileName: `camera-${assetId}.${captured.format || "jpg"}`,
        thumbnailSize: options.thumbnailSize,
      });

      return persistStoredImage(
        groupId,
        assetId,
        stored,
        options.sortOrder ?? 0,
      );
    }

    if (captured.dataUrl) {
      const stored = await invoke<StoredImage>("store_image_from_data_url", {
        assetId,
        groupId,
        dataUrl: captured.dataUrl,
        fileName: `camera-${assetId}.${captured.format || "jpg"}`,
        thumbnailSize: options.thumbnailSize,
      });

      return persistStoredImage(
        groupId,
        assetId,
        stored,
        options.sortOrder ?? 0,
      );
    }

    throw new Error("Camera capture did not return image data.");
  } finally {
    if (managePreview) {
      await stopPreview().catch(() => undefined);
    }
  }
}

export async function getAppImagePath(relativePath: string): Promise<string> {
  assertAppRelativePath(relativePath);
  return join(await appDataDir(), relativePath);
}

export async function getAppImageUrl(relativePath: string): Promise<string> {
  return convertFileSrc(await getAppImagePath(relativePath));
}

async function persistStoredImage(
  groupId: string,
  assetId: string,
  stored: StoredImage,
  sortOrder: number,
): Promise<Photo> {
  try {
    return await addPhoto({
      id: assetId,
      groupId,
      filePath: stored.filePath,
      thumbnailPath: stored.thumbnailPath,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      width: stored.width,
      height: stored.height,
      sortOrder,
    });
  } catch (error) {
    await invoke("remove_imported_images", {
      relativePaths: [stored.filePath, stored.thumbnailPath],
    }).catch(() => undefined);
    throw error;
  }
}

async function ensureCameraPermission(): Promise<void> {
  let state = await checkPermissions();

  if (state !== "granted") {
    await requestPermissions();
    state = await checkPermissions();
  }

  if (state !== "granted") {
    throw new Error("Camera permission was not granted.");
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function assertAppRelativePath(relativePath: string): void {
  const normalized = relativePath.replaceAll("\\", "/");
  const isAbsolute =
    normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized);
  const hasParentSegment = normalized
    .split("/")
    .some((segment) => segment === "..");

  if (!normalized || isAbsolute || hasParentSegment) {
    throw new Error("Expected an application-relative image path.");
  }
}
