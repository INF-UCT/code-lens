mod database;
mod jsonwebtoken;
mod mailer;
mod wiki;

pub mod errors;

use database::DatabaseConfig;
use sword::prelude::*;

pub use database::Database;
pub use errors::AppResult;
pub use jsonwebtoken::JsonWebTokenService;
pub use mailer::{Mail, Mailer, MailerConfig, TemplateRenderer};
pub use wiki::{WikiClient, WikiConfig};

pub struct SharedModule;

impl Module for SharedModule {
    async fn register_providers(config: &Config, providers: &ProviderRegistry) {
        let db_config = config.get_or_panic::<DatabaseConfig>();
        let database = Database::new(db_config).await;

        let mailer_config = config.get_or_panic::<MailerConfig>();
        let mailer = Mailer::new(mailer_config);

        let wiki_config = config.get_or_panic::<WikiConfig>();
        let wiki_client = WikiClient::new(wiki_config);

        providers.register(database);
        providers.register(mailer);
        providers.register(wiki_client);
    }

    fn register_components(components: &ComponentRegistry) {
        components.register::<JsonWebTokenService>();
    }
}
