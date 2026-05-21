import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface ViewErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface ViewErrorBoundaryState {
  error: Error | null;
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace view crashed", error, info.componentStack);
  }

  componentDidUpdate(previous: ViewErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-[#08080c] p-8">
        <div className="max-w-lg rounded-xl border border-red-400/25 bg-red-500/5 p-5 text-sm text-[var(--text-2)] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle size={16} />
            <span className="font-semibold">This view failed to render</span>
          </div>
          <pre className="max-h-44 overflow-auto rounded-lg border border-red-400/15 bg-black/25 p-3 text-xs text-red-100/80">
            {this.state.error.message}
          </pre>
          <Button className="mt-4" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={13} />
            Retry view
          </Button>
        </div>
      </div>
    );
  }
}
