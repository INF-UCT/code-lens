mod client;
mod templates;

use bon::Builder;
use serde::Deserialize;
use sword::prelude::*;
use thiserror::Error;

use lettre::{
    address::AddressError, error::Error as LettreError, transport::smtp::Error as SmtpError,
};

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

#[derive(Debug, Error)]
pub enum MailerError {
    #[error("SMTP transport error: {0}")]
    SmtpTransport(#[from] SmtpError),

    #[error("Email address error: {0}")]
    Address(#[from] AddressError),

    #[error("Message building error: {0}")]
    MessageBuild(#[from] LettreError),
}
