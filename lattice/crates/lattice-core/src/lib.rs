pub mod config;
pub mod errors;
pub mod events;
pub mod files;
pub mod vault;

pub use errors::{CoreError, CoreResult};
pub use files::{FileNode, NoteContent, SaveResult};
pub use vault::{Vault, VaultInfo, VaultState};
