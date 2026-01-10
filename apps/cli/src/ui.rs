use inquire::Select;
use std::fmt::Display;

#[derive(Debug, Clone)]
pub struct RepositoryInput {
    pub url: String,
}

#[derive(Debug, Clone, Copy)]
pub enum DurationOption {
    OneMonth,
    SixMonths,
    OneYear,
}

impl Display for DurationOption {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DurationOption::OneMonth => write!(f, "1 mes"),
            DurationOption::SixMonths => write!(f, "6 meses"),
            DurationOption::OneYear => write!(f, "1 año"),
        }
    }
}

pub fn prompt_repository_url() -> Result<RepositoryInput, inquire::error::InquireError> {
    let url = inquire::Text::new("Ingresa la URL del repositorio:")
        .with_placeholder("https://github.com/usuario/proyecto")
        .prompt()?;

    Ok(RepositoryInput { url })
}

pub fn prompt_token_duration() -> Result<DurationOption, inquire::error::InquireError> {
    let options = vec![
        DurationOption::OneMonth,
        DurationOption::SixMonths,
        DurationOption::OneYear,
    ];

    let selected = Select::new("Selecciona la duración del token:", options).prompt()?;

    Ok(selected)
}

#[derive(Debug, Clone, Copy)]
pub enum MainMenuOption {
    Generate,
    Refresh,
}

impl Display for MainMenuOption {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MainMenuOption::Generate => write!(f, "Generar nuevo token"),
            MainMenuOption::Refresh => write!(f, "Refrescar token existente"),
        }
    }
}

pub fn prompt_main_menu() -> Result<MainMenuOption, inquire::error::InquireError> {
    let options = vec![MainMenuOption::Generate, MainMenuOption::Refresh];
    Select::new("¿Qué deseas hacer?", options).prompt()
}
