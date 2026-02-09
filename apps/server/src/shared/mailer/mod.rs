mod client;
mod templates;

use bon::Builder;
use serde::Deserialize;
use sword::prelude::*;

pub use client::Mailer;
pub use templates::TemplateRenderer;

#[derive(Debug, Clone, Deserialize)]
#[config(key = "mailer")]
pub struct MailerConfig {
    pub smtp_host: String,
    pub smtp_port: String,
    pub smtp_username: String,
    pub smtp_password: String,
}

#[derive(Debug, Clone, Builder)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub html: String,
}
