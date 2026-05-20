export type PermissionScope =
  | "vault:read"
  | "vault:write"
  | "network:http"
  | "commands:register"
  | "ui:status-bar"
  | "ui:view"
  | "ui:theme"
  | "secrets:read"
  | "secrets:write"
  | "ai:embeddings"
  | "ai:inference";

export interface PermissionAPI {
  has(permission: PermissionScope): boolean;
  request(permission: PermissionScope, reason: string): Promise<boolean>;
}
