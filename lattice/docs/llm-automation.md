# LLM Automation Framework

LATTICE terminal sessions expose a project automation profile to AI CLIs.

## Environment

When a terminal session starts, LATTICE sets:

- `LATTICE_WORKSPACE_ROOT`: detected repository root when available.
- `LATTICE_VAULT_ROOT`: active vault root.
- `LATTICE_AUTOMATION_POLICY`: path to `AGENTS.md` or this document when found.

The terminal starts in the detected repository root when the app is running from this source checkout. If no repository root is detectable, it starts in the active vault.

## Safety Contract

The terminal is a real PTY. It does not sandbox arbitrary external CLIs by itself. Safety comes from:

- The AI CLI's own approval mode.
- The policy file loaded through `LATTICE_AUTOMATION_POLICY`.
- The visible terminal banner listing operations that require approval.

Critical operations requiring approval include destructive filesystem operations, dependency installs, networked writes, secret access, git history rewrites, and deployments.

## Agent Behavior

AI CLIs should:

- Read `AGENTS.md` before modifying code.
- Prefer local project scripts and package manager commands.
- Preserve unrelated worktree changes.
- Keep changes scoped to the user request.
- Verify with typechecks/tests before reporting completion.
