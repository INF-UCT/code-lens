use crate::shared::Event;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::{Mutex, mpsc::Receiver};
use tokio::time;

pub struct EventSubscriber {
    rx: Arc<Mutex<Receiver<Event>>>,
}

impl EventSubscriber {
    pub fn new(rx: Receiver<Event>) -> Self {
        Self {
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    pub fn handle_events(self) {
        tokio::spawn(async move {
            while let Some(event) = self.rx.lock().await.recv().await {
                self.handle_event(event);
            }
        });
    }

    fn handle_event(&self, event: Event) {
        tokio::spawn(async move {
            match event {
                Event::SendEmail => tracing::info!("Handling email event"),
                Event::InitDocsGen((repo_id, repo_path, _)) => {
                    tracing::info!("Handling repo_id={}", repo_id.to_string());
                    tracing::info!("Simulating documentation generation...");

                    time::sleep(time::Duration::from_secs(5)).await;

                    tracing::info!(
                        "Removing cloned repository at {}",
                        repo_path.to_str().unwrap_or_default()
                    );

                    fs::remove_dir_all(&repo_path).await.unwrap_or_else(|err| {
                        tracing::error!(
                            "Failed to remove directory {}: {}",
                            repo_path.to_str().unwrap_or_default(),
                            err
                        )
                    });
                }
            }
        });
    }
}
