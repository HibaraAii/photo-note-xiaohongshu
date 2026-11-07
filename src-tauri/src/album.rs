use serde::Serialize;
use sqlx::{Row, sqlite::SqliteRow};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::DATABASE_URL;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumGroup {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
}

#[tauri::command]
pub async fn create_album_group(
    db_instances: State<'_, DbInstances>,
    id: String,
    name: String,
) -> Result<AlbumGroup, String> {
    let name = name.trim();

    if name.is_empty() {
        return Err("Album group name cannot be empty.".to_string());
    }

    let instances = db_instances.0.read().await;
    let pool = match instances.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err("Database is not loaded. Call ensureDatabaseReady first.".to_string());
        }
    };
    drop(instances);

    let row = sqlx::query(
        r#"INSERT INTO album_groups (id, name)
         VALUES ($1, $2)
         RETURNING id, name, created_at, updated_at"#,
    )
    .bind(&id)
    .bind(name)
    .fetch_one(&pool)
    .await
    .map_err(|error| error.to_string())?;

    album_from_row(&row).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_album_groups(
    db_instances: State<'_, DbInstances>,
) -> Result<Vec<AlbumGroup>, String> {
    let instances = db_instances.0.read().await;
    let pool = match instances.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err("Database is not loaded. Call ensureDatabaseReady first.".to_string());
        }
    };
    drop(instances);

    let rows = sqlx::query(
        r#"SELECT id, name, created_at, updated_at
         FROM album_groups
         ORDER BY created_at DESC"#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| error.to_string())?;

    rows.iter()
        .map(|row| album_from_row(row).map_err(|error| error.to_string()))
        .collect()
}

fn album_from_row(row: &SqliteRow) -> Result<AlbumGroup, sqlx::Error> {
    Ok(AlbumGroup {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}
