use thiserror::Error;

pub type CoreResult<T> = Result<T, CoreError>;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path escapes vault: {0}")]
    PathTraversal(String),
    #[error("No vault is open")]
    NoVault,
    #[error("Invalid vault path: {0}")]
    InvalidVault(String),
}
