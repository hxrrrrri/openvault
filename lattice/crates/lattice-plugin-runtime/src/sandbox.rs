#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SandboxStatus {
    Planned,
    DisabledForMvp,
}

pub fn runtime_status() -> SandboxStatus {
    SandboxStatus::DisabledForMvp
}
