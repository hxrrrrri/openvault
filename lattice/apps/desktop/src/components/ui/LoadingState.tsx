import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-[var(--text-3)]">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle className="animate-spin text-[var(--violet-2)]" size={18} />
        {label}
      </div>
    </div>
  );
}
