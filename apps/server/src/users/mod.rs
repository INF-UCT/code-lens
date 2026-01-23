mod entity;
mod repository;

use sword::prelude::*;

pub use entity::User;
pub use repository::UserRepository;

pub struct UsersModule;

impl Module for UsersModule {
    fn register_components(components: &ComponentRegistry) {
        components.register::<UserRepository>();
    }
}
