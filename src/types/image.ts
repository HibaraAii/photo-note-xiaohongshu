import type { Photo } from "@/types/database";

export type CameraDirection = "front" | "back";
export type CameraFlashMode = "on" | "off" | "auto";

export interface ImageImportOptions {
  sortOrderStart?: number;
  thumbnailSize?: number;
}

export interface CameraPreviewOptions {
  camera?: CameraDirection;
  windowed?: boolean;
}

export interface CameraCaptureOptions extends CameraPreviewOptions {
  flash?: CameraFlashMode;
  format?: "jpeg" | "png";
  quality?: number;
  resolution?: {
    width: number;
    height: number;
  };
  aspectRatio?: string;
  managePreview?: boolean;
  sortOrder?: number;
  thumbnailSize?: number;
}

export type ImageImportResult = Photo;
