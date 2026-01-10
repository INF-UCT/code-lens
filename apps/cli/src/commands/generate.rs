use crate::api::ApiClient;
use crate::token::{format_token_info, generate_token, TokenDuration};
use crate::ui::{prompt_repository_url, prompt_token_duration, DurationOption};
use uuid::Uuid;

pub async fn execute() -> Result<(), Box<dyn std::error::Error>> {
    let repository_input = prompt_repository_url()?;
    let duration_option = prompt_token_duration()?;

    let token_duration = match duration_option {
        DurationOption::OneMonth => TokenDuration::OneMonth,
        DurationOption::SixMonths => TokenDuration::SixMonths,
        DurationOption::OneYear => TokenDuration::OneYear,
    };

    let jwt_secret =
        std::env::var("JWT_SECRET").expect("JWT_SECRET environment variable must be set");

    let unique_id = Uuid::new_v4().to_string();

    let token = generate_token(
        &repository_input.url,
        token_duration,
        &jwt_secret,
        Some(unique_id),
    )?;

    let response = ApiClient::new().register_token(&token).await?;

    if response.success {
        println!(
            "\n{}\n",
            format_token_info(&token, &repository_input.url, token_duration)
        );
        println!("✨ Proceso completado!");
    } else {
        return Err(format!("\nError: {}", response.message).into());
    }

    Ok(())
}
