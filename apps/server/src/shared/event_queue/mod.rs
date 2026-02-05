mod subscriber;

use crate::repositories::AnalyzeRepositoryData;
use sword::prelude::*;
use tokio::sync::mpsc;

pub use subscriber::EventSubscriber;

#[allow(dead_code)]
#[derive(Debug)]
pub enum Event {
    SendEmail,
    InitDocsGen(AnalyzeRepositoryData),
}

#[injectable(provider)]
pub struct EventQueue {
    tx: mpsc::Sender<Event>,
}

impl EventQueue {
    pub const fn new(tx: mpsc::Sender<Event>) -> Self {
        Self { tx }
    }

    pub async fn publish(&self, event: Event) {
        self.tx.send(event).await.ok();
    }
}
