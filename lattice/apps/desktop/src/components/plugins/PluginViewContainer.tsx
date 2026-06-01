import { useEffect, useRef, useState } from "react";
import { ensureObsidianDomShim } from "@/features/plugins/obsidian-dom";
import {
  clearPluginViewState,
  getPluginView,
  getPluginViewState,
  subscribeViewRegistry,
  subscribeViewState,
  type PluginViewInstance,
} from "@/features/plugins/view-registry";

interface PluginViewContainerProps {
  viewType: string;
  viewPath: string;
}

export function PluginViewContainer({ viewType, viewPath }: PluginViewContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<PluginViewInstance | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => subscribeViewRegistry(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    ensureObsidianDomShim();
    host.replaceChildren();
    const factory = getPluginView(viewType);
    if (!factory) {
      const empty = document.createElement("div");
      empty.className = "px-8 py-12 text-sm text-[var(--text-3)]";
      empty.textContent = `No plugin view registered for "${viewType}". Enable the providing plugin to render it.`;
      host.appendChild(empty);
      return;
    }

    let cancelled = false;
    const instance = factory.create(host);
    instanceRef.current = instance;
    void Promise.resolve()
      .then(async () => {
        if (cancelled) return;
        await instance.onOpen?.();
        const stateEntry = getPluginViewState(viewPath);
        if (stateEntry && typeof instance.setState === "function") {
          await instance.setState(stateEntry.state, { history: false });
        }
      })
      .catch((error) => console.warn(`Plugin view "${viewType}" open failed`, error));

    const unsubscribeState = subscribeViewState((path) => {
      if (path !== viewPath || cancelled) return;
      const entry = getPluginViewState(viewPath);
      if (entry && typeof instance.setState === "function") {
        void instance.setState(entry.state, { history: false });
      }
    });

    return () => {
      cancelled = true;
      unsubscribeState();
      try {
        void instance.onClose?.();
      } catch (error) {
        console.warn(error);
      }
      instanceRef.current = null;
      host.replaceChildren();
      clearPluginViewState(viewPath);
    };
  }, [viewType, viewPath]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[#0a0a10] px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
        Plugin view · {viewType}
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-auto bg-[#06060a]" />
    </div>
  );
}
