mod auth;
mod repositories;
mod shared;
mod tokens;
mod users;

mod logger;

use auth::AuthModule;
use repositories::RepositoriesModule;
use shared::SharedModule;
use tokens::TokensModule;
use users::UsersModule;

use logger::LoggerLayer;
use sword::Application;

#[sword::main]
async fn main() {
    let app = Application::builder()
        .with_module::<AuthModule>()
        .with_module::<UsersModule>()
        .with_module::<RepositoriesModule>()
        .with_module::<SharedModule>()
        .with_module::<TokensModule>()
        .with_layer(LoggerLayer())
        .build();

    app.run().await;
}
