import type { ReactNode } from "react";

export function EmptyState({ icon, title, body }: { icon?: ReactNode; title: string; body?: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-white/[0.015] p-8 text-center">
      <div>
        {icon && <div className="mb-3 flex justify-center text-[var(--text-4)]">{icon}</div>}
        <div className="text-sm font-semibold">{title}</div>
        {body && <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--text-3)]">{body}</p>}
      </div>
    </div>
  );
}
