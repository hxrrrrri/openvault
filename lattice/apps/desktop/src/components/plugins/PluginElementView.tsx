import { createElement } from "react";
import { getObsidianPluginHost } from "@/features/plugins/obsidian-host";
import type { SerializedObsidianElement } from "@/features/plugins/obsidian-runtime";

const allowedTags = new Set(["div", "span", "p", "strong", "em", "small", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "button", "input", "textarea", "select", "option", "ul", "ol", "li"]);

export function PluginElementView({ element }: { element?: SerializedObsidianElement }) {
  if (!element) return null;
  return <PluginElementNode element={element} />;
}

function PluginElementNode({ element }: { element: SerializedObsidianElement }) {
  const tagName = normalizedTag(element.tagName);
  const attrs = sanitizedAttrs(element.attributes);
  const className = element.classes.filter(Boolean).join(" ") || undefined;
  const children = (
    <>
      {element.textContent}
      {element.children.map((child, index) => (
        <PluginElementNode key={`${child.tagName}:${index}`} element={child} />
      ))}
    </>
  );

  if (tagName === "input") {
    return <input className={className} readOnly value={String(attrs.value ?? "")} placeholder={String(attrs.placeholder ?? "")} type={String(attrs.type ?? "text")} />;
  }

  if (tagName === "button") {
    const actionId = typeof attrs["data-lattice-action-id"] === "string" ? attrs["data-lattice-action-id"] : null;
    const pluginId = typeof attrs["data-lattice-plugin-id"] === "string" ? attrs["data-lattice-plugin-id"] : actionId?.split(":action:")[0];
    return (
      <button
        type="button"
        className={className}
        aria-pressed={attrs["aria-pressed"] === true}
        disabled={!actionId || !pluginId}
        onClick={() => {
          if (actionId && pluginId) void getObsidianPluginHost().invokeCommand(pluginId, actionId);
        }}
      >
        {children}
      </button>
    );
  }

  return createElement(tagName, { className, ...attrs }, children);
}

function normalizedTag(tagName: string): string {
  const clean = tagName.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return allowedTags.has(clean) ? clean : "div";
}

function sanitizedAttrs(attrs: Record<string, string>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) continue;
    if (key === "style" || key.startsWith("style.")) continue;
    if (["href", "src"].includes(key)) continue;
    if (!/^(aria-|data-|type$|value$|placeholder$|title$|role$|id$)/.test(key)) continue;
    next[key] = key === "aria-pressed" ? value === "true" : value;
  }
  return next;
}
