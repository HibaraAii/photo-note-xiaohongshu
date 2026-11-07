use std::time::Duration;

const CCSWITCH_ENDPOINT: &str = "http://127.0.0.1:15721/v1/chat/completions";
const CCSWITCH_API_KEY: &str = "CC Switch key";

#[tauri::command]
pub async fn call_ccswitch_llm(payload: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("Failed to build CC Switch client: {error}"))?;

    let response = client
        .post(CCSWITCH_ENDPOINT)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {CCSWITCH_API_KEY}"),
        )
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(payload)
        .send()
        .await
        .map_err(|error| format!("CC Switch request failed: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read CC Switch response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "CC Switch request failed: status={status}, body={body}"
        ));
    }

    Ok(body)
}
