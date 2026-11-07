export interface AlbumGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  groupId: string;
  filePath: string;
  thumbnailPath: string | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface Draft {
  id: string;
  groupId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlbumGroupInput {
  name: string;
}

export interface AddPhotoInput {
  id?: string;
  groupId: string;
  filePath: string;
  thumbnailPath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder?: number;
}

export interface SaveDraftInput {
  groupId: string;
  content: string;
}
