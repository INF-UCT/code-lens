use crate::mailer::Mailer;
use crate::shared::Event;
use crate::shared::event_queue::EventHandler;

use std::sync::Arc;
use tokio::sync::{Mutex, mpsc::Receiver};

pub struct EventSubscriber {
    rx: Arc<Mutex<Receiver<Event>>>,
    handler: Arc<EventHandler>,
}

impl EventSubscriber {
    pub fn new(rx: Receiver<Event>, mailer: Mailer) -> Self {
        let handler = EventHandler::builder().mailer(mailer).build();

        Self {
            rx: Arc::new(Mutex::new(rx)),
            handler: Arc::new(handler),
        }
    }

    pub fn run(self) {
        tokio::spawn(async move {
            if let Err(e) = self.subscribe().await {
                tracing::error!("Error in event subscriber: {e}");
            }
        });
    }

    pub async fn subscribe(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        while let Some(event) = self.rx.lock().await.recv().await {
            let handler = Arc::clone(&self.handler);

            tokio::spawn(async move {
                Self::handle(Arc::clone(&handler), event.clone()).await;
            });
        }

        Ok(())
    }

    async fn handle(handler: Arc<EventHandler>, event: Event) {
        match event {
            Event::InitDocsGen(data) => {
                handler.init_docs_generation(data.0, data.1, data.2).await;
            }
        }
    }
}
