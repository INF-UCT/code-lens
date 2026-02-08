mod auth;
mod logger;
mod mailer;
mod repositories;
mod shared;
mod tokens;
mod users;

use auth::AuthModule;
use repositories::RepositoriesModule;
use shared::SharedModule;
use tokens::TokensModule;
use users::UsersModule;

use logger::LoggerLayer;
use shared::Event;
use sword::prelude::*;
use tokio::sync::mpsc;

use crate::{
    mailer::{Mailer, MailerConfig},
    shared::{EventQueue, EventSubscriber},
};

#[sword::main]
async fn main() {
    let config = Config::new().expect("Failed to load configuration");

    let mailer_config = config.get_or_panic::<MailerConfig>();
    let mailer = Mailer::new(mailer_config);

    let (tx, rx) = mpsc::channel::<Event>(100);
    let event_queue = EventQueue::new(tx);
    let event_subscriber = EventSubscriber::new(rx, mailer);

    event_subscriber.run();

    let app = ApplicationBuilder::from_config(config)
        .with_provider(event_queue)
        .with_module::<AuthModule>()
        .with_module::<UsersModule>()
        .with_module::<RepositoriesModule>()
        .with_module::<SharedModule>()
        .with_module::<TokensModule>()
        .with_layer(LoggerLayer())
        .build();

    app.run().await;
}
