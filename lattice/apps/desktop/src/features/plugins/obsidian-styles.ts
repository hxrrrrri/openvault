const styleAttribute = "data-lattice-plugin-style";

export function registerPluginStyles(pluginId: string, css: string, root: Document = document): () => void {
  if (!css.trim()) return () => {};

  root.head
    .querySelectorAll<HTMLStyleElement>(`style[${styleAttribute}="${cssEscape(pluginId)}"]`)
    .forEach((element) => element.remove());

  const style = root.createElement("style");
  style.setAttribute(styleAttribute, pluginId);
  style.textContent = `/* LATTICE managed plugin styles: ${pluginId} */\n${css}`;
  root.head.appendChild(style);

  return () => {
    style.remove();
  };
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
