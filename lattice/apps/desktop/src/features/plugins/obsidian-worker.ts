import { loadObsidianPlugin, type LoadedObsidianPlugin, type ObsidianHostBridge, type ObsidianRuntimeBundle, type ObsidianRuntimeContext } from "./obsidian-runtime";

type HostRequest =
  | { type: "load"; requestId: number; bundle: ObsidianRuntimeBundle; context: ObsidianRuntimeContext }
  | { type: "unload"; requestId: number }
  | { type: "invokeCommand"; requestId: number; commandId: string }
  | { type: "callResult"; requestId: number; ok: true; value: unknown }
  | { type: "callResult"; requestId: number; ok: false; error: string };

let loaded: LoadedObsidianPlugin | null = null;
let nextCallId = 1;
const pendingCalls = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let permissions = new Set<string>();

const bridge: ObsidianHostBridge = {
  hasPermission(permission) {
    return permissions.has(permission);
  },
  call(action, payload) {
    const requestId = nextCallId++;
    self.postMessage({ type: "call", requestId, action, payload });
    return new Promise<unknown>((resolve, reject) => {
      pendingCalls.set(requestId, { resolve, reject });
    }) as Promise<never>;
  },
  emit(event) {
    self.postMessage({ type: "event", event });
  },
};

self.onmessage = (message: MessageEvent<HostRequest>) => {
  void handleMessage(message.data);
};

async function handleMessage(message: HostRequest): Promise<void> {
  if (message.type === "callResult") {
    const pending = pendingCalls.get(message.requestId);
    if (!pending) return;
    pendingCalls.delete(message.requestId);
    if (message.ok) pending.resolve(message.value);
    else pending.reject(new Error(message.error));
    return;
  }

  try {
    if (message.type === "load") {
      permissions = new Set(message.bundle.grantedPermissions.filter((grant) => grant.granted).map((grant) => grant.permission));
      denyAmbientNetworkWhenUngated();
      loaded = await loadObsidianPlugin(message.bundle, bridge, message.context);
      self.postMessage({ type: "loaded", requestId: message.requestId, commands: loaded.commands });
    }
    if (message.type === "unload") {
      await loaded?.unload();
      loaded = null;
      self.postMessage({ type: "unloaded", requestId: message.requestId });
    }
    if (message.type === "invokeCommand") {
      await loaded?.invokeCommand(message.commandId);
      self.postMessage({ type: "commandInvoked", requestId: message.requestId });
    }
  } catch (error) {
    self.postMessage({ type: "error", requestId: message.requestId, error: String(error) });
  }
}

function denyAmbientNetworkWhenUngated(): void {
  if (permissions.has("network:http")) return;
  const denied = () => Promise.reject(new Error("Permission denied for network:http"));
  Object.assign(self, {
    fetch: denied,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    EventSource: undefined,
  });
}
