pub fn into_command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
