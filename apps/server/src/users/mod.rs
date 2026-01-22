mod dtos;
mod repository;

pub use dtos::{CreateUser, User};
pub use repository::UserRepository;

use sword::prelude::*;

pub struct UsersModule;

impl Module for UsersModule {
    fn register_components(components: &ComponentRegistry) {
        components.register::<UserRepository>();
    }
}
