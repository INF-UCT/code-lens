use crate::api::{ApiClient, DurationMonths};
use crate::ui::{prompt_repository_url, prompt_token_duration, DurationOption};

pub async fn execute() -> Result<(), Box<dyn std::error::Error>> {
    let repository_input = prompt_repository_url()?;
    let duration_option = prompt_token_duration()?;

    let expiration_months = match duration_option {
        DurationOption::OneMonth => DurationMonths::One,
        DurationOption::SixMonths => DurationMonths::Six,
        DurationOption::OneYear => DurationMonths::Twelve,
    };

    println!("\n[*] Generando token...");

    let token = ApiClient::new()
        .register_token(&repository_input.url, expiration_months)
        .await?;

    println!(
        "\n[+] Token generado exitosamente\n\n\
         Repository: {}\n\
         Duration: {}\n\
         Token:\n\n{}\n",
        repository_input.url, duration_option, token
    );

    println!("[+] Completado");

    Ok(())
}
