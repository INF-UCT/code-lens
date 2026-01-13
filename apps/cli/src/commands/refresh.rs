use crate::api::ApiClient;

pub async fn execute() -> Result<(), Box<dyn std::error::Error>> {
    let old_token = inquire::Text::new("Ingresa el token a refrescar:")
        .with_placeholder("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...")
        .prompt()?;

    println!("\n[*] Refrescando token...");

    let new_token = ApiClient::new()
        .refresh_token(&old_token)
        .await?;

    println!(
        "\n[+] Token refrescado exitosamente\n\n\
         Nuevo Token:\n\n{}\n",
        new_token
    );

    println!("[+] Completado");

    Ok(())
}
