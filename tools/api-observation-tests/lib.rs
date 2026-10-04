// Test the production detector and cache without linking the Tauri/GTK interface.
#[path = "../../src-tauri/src/commands/api_scanner/mod.rs"]
pub mod api_scanner;
pub mod commands {
    pub use crate::api_scanner;
}
