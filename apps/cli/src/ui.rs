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
            DurationOption::OneMonth => write!(f, "1 month"),
            DurationOption::SixMonths => write!(f, "6 months"),
            DurationOption::OneYear => write!(f, "1 year"),
        }
    }
}

pub fn prompt_repository_url() -> Result<RepositoryInput, inquire::error::InquireError> {
    let url = inquire::Text::new("Repository URL:")
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

    let selected = Select::new("Select token duration:", options).prompt()?;

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
            MainMenuOption::Generate => write!(f, "Generate new token"),
            MainMenuOption::Refresh => write!(f, "Refresh existing token"),
        }
    }
}

pub fn prompt_main_menu() -> Result<MainMenuOption, inquire::error::InquireError> {
    let options = vec![MainMenuOption::Generate, MainMenuOption::Refresh];
    Select::new("What would you like to do?", options).prompt()
}
