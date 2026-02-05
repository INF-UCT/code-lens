use crate::shared::Event;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc::Receiver};

pub struct EventSubscriber {
    rx: Arc<Mutex<Receiver<Event>>>,
}

impl EventSubscriber {
    pub fn new(rx: Receiver<Event>) -> Self {
        Self {
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    pub async fn handle_events(&self) {
        while let Some(event) = self.rx.lock().await.recv().await {
            self.handle_event(event).await;
        }
    }

    async fn handle_event(&self, event: Event) {
        tokio::spawn(async move {
            match event {
                Event::SendEmail => tracing::info!("Handling email event"),
                Event::AnalyzeRepository((repo_id, repo_path, repository_user_email)) => {
                    tracing::info!(
                        "Handling repo_id={}, path={}, email={}",
                        repo_id,
                        repo_path.to_str().unwrap_or_default(),
                        repository_user_email
                    );
                }
            }
        });
    }
}
