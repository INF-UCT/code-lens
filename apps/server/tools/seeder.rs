use sqlx::{PgPool, Postgres};
use std::env;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    let db_url = env::var("POSTGRES_DATABASE_URL").expect("DATABASE_URL must be set");
    let db_client = PgPool::connect(&db_url)
        .await
        .expect("Failed to connect to the database");

    let user_id = Uuid::new_v4();
    let username = env::var("TEST_USERNAME").unwrap_or_else(|_| "test_user".to_string());
    let email = env::var("TEST_EMAIL").unwrap_or_else(|_| "test_email@mail.com".to_string());

    sqlx::query::<Postgres>(
        "
		INSERT INTO users (id, username, email) VALUES
		($1, $2, $3)
		ON CONFLICT (id) DO NOTHING;
		",
    )
    .bind(user_id)
    .bind(username)
    .bind(email)
    .execute(&db_client)
    .await
    .expect("Failed to insert test user");
}
