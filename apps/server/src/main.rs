mod auth;
mod logger;
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
use sword::Application;
use tokio::sync::mpsc;

use crate::shared::{EventQueue, EventSubscriber};

#[sword::main]
async fn main() {
    let (tx, rx) = mpsc::channel::<Event>(100);

    let event_queue = EventQueue::new(tx);
    let event_subscriber = EventSubscriber::new(rx);

    event_subscriber.handle_events();

    let app = Application::builder()
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
