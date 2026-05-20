import { X } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

interface ModalProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function Modal({ title, eyebrow, icon, onClose, footer, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050507]/75 p-6 backdrop-blur-md"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className="anim-scale-in flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-[18px] border border-violet/30 bg-gradient-to-b from-[#1a1a22] to-[#0e0e13] shadow-[var(--shadow-float),0_0_60px_rgba(139,124,255,0.2)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="pixel-label text-[10px]">{eyebrow}</div>}
            <h2 className="truncate text-base font-semibold">{title}</h2>
          </div>
          <IconButton label="Close modal" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</footer>}
      </section>
    </div>
  );
}
