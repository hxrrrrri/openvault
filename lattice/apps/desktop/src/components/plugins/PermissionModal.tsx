import { BrainCircuit, FileText, Globe, KeyRound, LayoutPanelTop, ListPlus, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { PermissionGrant, PluginInfo } from "@/types/domain";

const permissions = [
  { id: "vault:read", label: "Vault read", desc: "Read Markdown files inside the active vault.", icon: <FileText size={15} /> },
  { id: "vault:write", label: "Vault write", desc: "Create or modify Markdown files in the active vault.", icon: <FileText size={15} /> },
  { id: "commands:register", label: "Commands", desc: "Register command palette actions.", icon: <ListPlus size={15} /> },
  { id: "ui:theme", label: "UI surface", desc: "Add status bar, view, or theme contributions.", icon: <LayoutPanelTop size={15} /> },
  { id: "ai:embeddings", label: "Local AI", desc: "Use local embeddings and inference providers.", icon: <BrainCircuit size={15} /> },
  { id: "network:http", label: "Network", desc: "Make HTTP requests to external services.", icon: <Globe size={15} /> },
  { id: "secrets:read", label: "Secrets", desc: "Read encrypted secrets through the broker.", icon: <KeyRound size={15} /> },
];

export function PermissionModal({ plugin, onClose, onSave }: { plugin: PluginInfo; onClose: () => void; onSave: (grants: PermissionGrant[]) => void }) {
  const [grants, setGrants] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(permissions.map((permission) => [permission.id, plugin.grantedPermissions.some((grant) => grant.permission === permission.id && grant.granted)])),
  );

  return (
    <Modal
      title={plugin.name}
      eyebrow="Review permissions"
      icon={
        <div className="grid size-11 place-items-center rounded-xl border border-[var(--border)] bg-black/30 text-[var(--violet-2)]">
          <Shield size={18} />
        </div>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(Object.entries(grants).map(([permission, granted]) => ({ permission, granted })));
              onClose();
            }}
          >
            Save permissions
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm leading-6 text-[var(--text-2)]">Plugins receive only the permissions you grant. Network and secret access stay off unless explicitly enabled.</p>
      <div className="space-y-2">
        {permissions.map((permission) => {
          const requested = plugin.grantedPermissions.some((grant) => grant.permission === permission.id);
          return (
            <div
              key={permission.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${requested ? "border-violet/25 bg-violet/5" : "border-[var(--border)] bg-white/[0.015] opacity-60"}`}
            >
              <div className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-black/30 text-[var(--violet-2)]">{permission.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {permission.label}
                  {!requested && <span className="mono text-[9px] text-[var(--text-4)]">NOT REQUESTED</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-3)]">{permission.desc}</div>
              </div>
              {requested && <button className={`toggle ${grants[permission.id] ? "on" : ""}`} onClick={() => setGrants((current) => ({ ...current, [permission.id]: !current[permission.id] }))} />}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
