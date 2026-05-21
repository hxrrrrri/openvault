import { BrainCircuit, Database, FileText, Globe, HardDrive, KeyRound, LayoutPanelTop, ListPlus, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { PermissionGrant, PluginInfo } from "@/types/domain";

const permissionCatalog = [
  { id: "vault:read", label: "Vault read", desc: "Read Markdown files inside the active vault.", icon: <FileText size={15} /> },
  { id: "vault:write", label: "Vault write", desc: "Create or modify Markdown files in the active vault.", icon: <FileText size={15} /> },
  { id: "workspace:read", label: "Workspace read", desc: "Read active file and workspace state.", icon: <LayoutPanelTop size={15} /> },
  { id: "workspace:layout", label: "Workspace layout", desc: "Open leaves or adjust workspace layout.", icon: <LayoutPanelTop size={15} /> },
  { id: "workspace:views", label: "Workspace views", desc: "Register Markdown processors or custom view surfaces.", icon: <LayoutPanelTop size={15} /> },
  { id: "editor:read", label: "Editor read", desc: "Read editor selection or active editor state.", icon: <FileText size={15} /> },
  { id: "editor:write", label: "Editor write", desc: "Insert or replace editor content.", icon: <FileText size={15} /> },
  { id: "editor:commands", label: "Editor commands", desc: "Register Obsidian-style commands.", icon: <ListPlus size={15} /> },
  { id: "commands:register", label: "Commands", desc: "Register command palette actions.", icon: <ListPlus size={15} /> },
  { id: "ui:ribbon", label: "Ribbon", desc: "Add a ribbon action.", icon: <LayoutPanelTop size={15} /> },
  { id: "ui:status-bar", label: "Status bar", desc: "Add status bar content.", icon: <LayoutPanelTop size={15} /> },
  { id: "ui:settings-tab", label: "Settings tab", desc: "Add plugin settings UI.", icon: <LayoutPanelTop size={15} /> },
  { id: "ui:modal", label: "Modals and notices", desc: "Show modal or notice surfaces.", icon: <LayoutPanelTop size={15} /> },
  { id: "ui:theme", label: "Plugin styles", desc: "Load plugin styles through the managed style registry.", icon: <LayoutPanelTop size={15} /> },
  { id: "storage:plugin-data", label: "Plugin data", desc: "Read and write this plugin's LATTICE-managed data.json.", icon: <Database size={15} /> },
  { id: "ai:embeddings", label: "Local AI", desc: "Use local embeddings and inference providers.", icon: <BrainCircuit size={15} /> },
  { id: "network:http", label: "Network", desc: "Make HTTP requests to external services.", icon: <Globe size={15} /> },
  { id: "system:node-api", label: "Node adapter", desc: "Use gated desktop-only Node compatibility adapters.", icon: <HardDrive size={15} /> },
  { id: "system:filesystem", label: "Filesystem adapter", desc: "Use gated desktop-only filesystem compatibility adapters.", icon: <HardDrive size={15} /> },
  { id: "secrets:read", label: "Secrets", desc: "Read encrypted secrets through the broker.", icon: <KeyRound size={15} /> },
];

export function PermissionModal({ plugin, onClose, onSave }: { plugin: PluginInfo; onClose: () => void; onSave: (grants: PermissionGrant[]) => void }) {
  const [grants, setGrants] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(plugin.grantedPermissions.map((grant) => [grant.permission, grant.granted])),
  );
  const permissions = plugin.grantedPermissions.map((grant) => permissionFor(grant.permission));

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
              onSave(plugin.grantedPermissions.map((grant) => ({ ...grant, granted: Boolean(grants[grant.permission]) })));
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

function permissionFor(id: string) {
  return (
    permissionCatalog.find((permission) => permission.id === id) ?? {
      id,
      label: id,
      desc: "Plugin-requested compatibility permission.",
      icon: <Shield size={15} />,
    }
  );
}
