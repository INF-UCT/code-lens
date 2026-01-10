use crate::api::ApiClient;
use crate::token::{decode_token, format_token_info, generate_token, TokenDuration};
use crate::ui::{prompt_token_duration, DurationOption};

pub async fn execute() -> Result<(), Box<dyn std::error::Error>> {
    let old_token = inquire::Text::new("Ingresa el token antiguo:")
        .with_placeholder("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...")
        .prompt()?;

    let jwt_secret =
        std::env::var("JWT_SECRET").expect("JWT_SECRET environment variable must be set");

    let claims = decode_token(&old_token, &jwt_secret)?;

    let duration_option = prompt_token_duration()?;

    let token_duration = match duration_option {
        DurationOption::OneMonth => TokenDuration::OneMonth,
        DurationOption::SixMonths => TokenDuration::SixMonths,
        DurationOption::OneYear => TokenDuration::OneYear,
    };

    let unique_id = claims.jti.clone();
    let new_token = generate_token(&claims.sub, token_duration, &jwt_secret, Some(unique_id))?;

    let response = ApiClient::new().refresh_token(&new_token).await?;

    if response.success {
        println!(
            "\n{}\n",
            format_token_info(&new_token, &claims.sub, token_duration)
        );
        println!("✨ Proceso completado!: {}\n", response.message);
    } else {
        return Err(format!("\nError: {}", response.message).into());
    }

    Ok(())
}
