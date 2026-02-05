mod subscriber;

use crate::repositories::AnalyzeRepositoryData;
use sword::prelude::*;
use tokio::sync::mpsc;

pub use subscriber::EventSubscriber;

#[allow(dead_code)]
#[derive(Debug)]
pub enum Event {
    SendEmail,
    AnalyzeRepository(AnalyzeRepositoryData),
}

#[injectable(provider)]
pub struct EventQueue {
    tx: mpsc::Sender<Event>,
}

impl EventQueue {
    pub fn new(tx: mpsc::Sender<Event>) -> Self {
        Self { tx }
    }

    pub async fn _publish(&self, event: Event) {
        self.tx.send(event).await.ok();
    }
}
