import { TriangleAlert } from "lucide-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-red-400/25 bg-red-500/5 p-4 text-sm text-[var(--danger)]">
      <div className="flex items-center gap-2">
        <TriangleAlert size={16} />
        {message}
      </div>
    </div>
  );
}
