import { X } from "lucide-react";
import { useEffect } from "react";
import { usePluginUIStore } from "@/stores/plugin-ui-store";

export function PluginNotices() {
  const notices = usePluginUIStore((state) => state.notices);
  const dismissNotice = usePluginUIStore((state) => state.dismissNotice);

  useEffect(() => {
    const timers = notices.map((notice) =>
      window.setTimeout(() => dismissNotice(notice.id), Math.max(1200, notice.timeout || 4000)),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [dismissNotice, notices]);

  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="pointer-events-auto rounded-lg border border-[var(--border)] bg-[#14141a]/95 px-3 py-2.5 text-sm text-[var(--text)] shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="mono mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--text-4)]">{notice.pluginId}</div>
              <div className="leading-5">{notice.message}</div>
            </div>
            <button
              type="button"
              title="Dismiss"
              className="grid size-6 shrink-0 place-items-center rounded text-[var(--text-3)] transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => dismissNotice(notice.id)}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
