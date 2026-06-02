import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Human label for what failed, e.g. "The graph view crashed". */
  label?: string;
  /** Called when the user clicks "Try again". */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree so one broken panel cannot take
 * down the whole app. Wrap each major route in its own boundary (use a `key`
 * that changes on navigation so moving away clears a crashed view).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the devtools console; no telemetry is sent.
    console.error("[ErrorBoundary]", this.props.label ?? "subtree error", error, info);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center text-[var(--text-2)]"
      >
        <AlertTriangle className="text-[var(--warning)]" size={28} />
        <h2 className="text-sm font-medium text-[var(--text)]">
          {this.props.label ?? "Something went wrong"}
        </h2>
        <p className="mono max-w-md truncate text-[11px] text-[var(--text-3)]" title={error.message}>
          {error.message}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-1 rounded border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text)] hover:bg-[var(--bg-2)]"
        >
          Try again
        </button>
      </div>
    );
  }
}
