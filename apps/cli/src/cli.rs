use crate::commands;
use crate::ui::{prompt_main_menu, MainMenuOption};

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    print_welcome_header();

    let menu_option = prompt_main_menu()?;

    match menu_option {
        MainMenuOption::Generate => commands::generate::execute().await?,
        MainMenuOption::Refresh => commands::refresh::execute().await?,
    }

    Ok(())
}

fn print_welcome_header() {
    println!("CodeLens - Token Generator\n");
}
