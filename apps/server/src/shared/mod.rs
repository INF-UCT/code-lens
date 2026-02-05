mod database;
pub mod errors;
mod event_queue;
mod jsonwebtoken;

use database::DatabaseConfig;
use sword::prelude::*;

pub use database::Database;
pub use errors::AppResult;
pub use event_queue::{Event, EventQueue, EventSubscriber};
pub use jsonwebtoken::JsonWebTokenService;

pub struct SharedModule;

impl Module for SharedModule {
    async fn register_providers(config: &Config, providers: &ProviderRegistry) {
        let db_config = config.get_or_panic::<DatabaseConfig>();
        let database = Database::new(db_config).await;

        providers.register(database);
    }

    fn register_components(components: &ComponentRegistry) {
        components.register::<JsonWebTokenService>();
    }
}
