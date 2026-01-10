use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub success: bool,
    pub message: String,
    pub token: Option<String>,
}

pub struct ApiClient {
    base_url: String,
    client: reqwest::Client,
}

impl ApiClient {
    pub fn new() -> Self {
        let base_url = std::env::var("CODELENS_SERVER_URL")
            .expect("CODELENS_SERVER_URL environment variable must be set");

        Self {
            base_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn register_token(
        &self,
        token: &str,
    ) -> Result<TokenResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/auth/register-token", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;

        let body = response.json::<TokenResponse>().await?;
        Ok(body)
    }

    pub async fn refresh_token(
        &self,
        new_token: &str,
    ) -> Result<TokenResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/auth/refresh-token", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", new_token))
            .send()
            .await?;

        let body = response.json::<TokenResponse>().await?;
        Ok(body)
    }
}
