import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type {
  AddPhotoInput,
  AlbumGroup,
  CreateAlbumGroupInput,
  Draft,
  Photo,
  SaveDraftInput,
} from "@/types/database";

export const DATABASE_URL = "sqlite:photo-note.db";

let databasePromise: Promise<Database> | null = null;

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function ensureDatabaseReady(): Promise<void> {
  await getDatabase();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

export async function createAlbumGroup(
  input: CreateAlbumGroupInput,
): Promise<AlbumGroup> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Album group name cannot be empty.");
  }

  await getDatabase();

  return invoke<AlbumGroup>("create_album_group", {
    id: createId(),
    name,
  });
}

export async function listAlbumGroups(): Promise<AlbumGroup[]> {
  await getDatabase();

  return invoke<AlbumGroup[]>("list_album_groups");
}

export async function deleteAlbumGroup(groupId: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    "DELETE FROM album_groups WHERE id = $1",
    [groupId],
  );

  return result.rowsAffected > 0;
}

export async function addPhoto(input: AddPhotoInput): Promise<Photo> {
  const database = await getDatabase();
  const photo: Photo = {
    id: input.id ?? createId(),
    groupId: input.groupId,
    filePath: input.filePath,
    thumbnailPath: input.thumbnailPath ?? null,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: currentTimestamp(),
  };

  await database.execute(
    `INSERT INTO photos (
       id,
       group_id,
       file_path,
       thumbnail_path,
       file_name,
       mime_type,
       width,
       height,
       sort_order,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      photo.id,
      photo.groupId,
      photo.filePath,
      photo.thumbnailPath,
      photo.fileName,
      photo.mimeType,
      photo.width,
      photo.height,
      photo.sortOrder,
      photo.createdAt,
    ],
  );

  return photo;
}

export async function listPhotosByGroup(groupId: string): Promise<Photo[]> {
  const database = await getDatabase();

  return database.select<Photo[]>(
    `SELECT
       id,
       group_id AS groupId,
       file_path AS filePath,
       thumbnail_path AS thumbnailPath,
       file_name AS fileName,
       mime_type AS mimeType,
       width,
       height,
       sort_order AS sortOrder,
       created_at AS createdAt
     FROM photos
     WHERE group_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [groupId],
  );
}

export async function deletePhoto(photoId: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute("DELETE FROM photos WHERE id = $1", [
    photoId,
  ]);

  return result.rowsAffected > 0;
}

export async function saveDraft(input: SaveDraftInput): Promise<Draft> {
  const database = await getDatabase();
  const timestamp = currentTimestamp();

  await database.execute(
    `INSERT INTO drafts (id, group_id, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(group_id) DO UPDATE SET
       content = excluded.content,
       updated_at = excluded.updated_at`,
    [createId(), input.groupId, input.content, timestamp, timestamp],
  );

  const draft = await getDraftByGroup(input.groupId);

  if (!draft) {
    throw new Error("Failed to load the saved draft.");
  }

  return draft;
}

export async function getDraftByGroup(groupId: string): Promise<Draft | null> {
  const database = await getDatabase();
  const drafts = await database.select<Draft[]>(
    `SELECT
       id,
       group_id AS groupId,
       content,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM drafts
     WHERE group_id = $1
     LIMIT 1`,
    [groupId],
  );

  return drafts[0] ?? null;
}
