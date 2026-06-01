interface CreateElOptions {
  text?: string;
  cls?: string | string[];
  attr?: Record<string, string>;
  href?: string;
  title?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  parent?: HTMLElement;
  prepend?: boolean;
}

declare global {
  interface Element {
    createDiv(options?: CreateElOptions | string): HTMLDivElement;
    createSpan(options?: CreateElOptions | string): HTMLSpanElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: CreateElOptions | string,
    ): HTMLElementTagNameMap[K];
    empty(): void;
    setText(value: string): this;
    setAttr(name: string, value: string | number | boolean | null): this;
    setAttrs(attrs: Record<string, string | number | boolean | null>): this;
    getAttr(name: string): string | null;
    addClass(...names: string[]): this;
    addClasses(names: string[]): this;
    removeClass(...names: string[]): this;
    removeClasses(names: string[]): this;
    toggleClass(name: string, value?: boolean): this;
    hasClass(name: string): boolean;
    appendText(text: string): this;
    matchParent(selector: string, lastParent?: Element): Element | null;
  }
  interface HTMLElement {
    show(): this;
    hide(): this;
    isShown(): boolean;
    onClickEvent(callback: (event: MouseEvent) => void): this;
  }
  interface Node {
    detach(): void;
    empty(): void;
  }
  interface DocumentFragment {
    createDiv(options?: CreateElOptions | string): HTMLDivElement;
    createSpan(options?: CreateElOptions | string): HTMLSpanElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: CreateElOptions | string,
    ): HTMLElementTagNameMap[K];
  }
  interface Document {
    createDiv(options?: CreateElOptions | string): HTMLDivElement;
    createSpan(options?: CreateElOptions | string): HTMLSpanElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: CreateElOptions | string,
    ): HTMLElementTagNameMap[K];
  }
  interface String {
    contains(search: string): boolean;
  }
  interface Array<T> {
    first(): T | undefined;
    last(): T | undefined;
    remove(item: T): this;
  }
}

let patched = false;

function applyOptions(el: Element, opts?: CreateElOptions | string): void {
  if (!opts) return;
  if (typeof opts === "string") {
    el.textContent = opts;
    return;
  }
  if (typeof opts.text === "string") el.textContent = opts.text;
  if (opts.cls) {
    if (Array.isArray(opts.cls)) el.classList.add(...opts.cls.filter(Boolean));
    else (el as HTMLElement).className = opts.cls;
  }
  if (opts.attr) {
    for (const [name, value] of Object.entries(opts.attr)) {
      if (value === null || value === undefined) el.removeAttribute(name);
      else el.setAttribute(name, String(value));
    }
  }
  if (typeof opts.href === "string") el.setAttribute("href", opts.href);
  if (typeof opts.title === "string") el.setAttribute("title", opts.title);
  if (typeof opts.type === "string") el.setAttribute("type", opts.type);
  if (typeof opts.value === "string" && "value" in el) (el as unknown as HTMLInputElement).value = opts.value;
  if (typeof opts.placeholder === "string") el.setAttribute("placeholder", opts.placeholder);
}

function defineOn(proto: object | undefined, key: string, value: unknown): void {
  if (!proto) return;
  const record = proto as Record<string, unknown>;
  if (key in record) return;
  try {
    Object.defineProperty(proto, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    record[key] = value;
  }
}

export function ensureObsidianDomShim(): void {
  if (patched || typeof HTMLElement === "undefined") return;
  patched = true;

  const createElImpl = function (
    this: Node,
    tag: string,
    opts?: CreateElOptions | string,
  ): HTMLElement {
    const el = document.createElement(tag);
    applyOptions(el, opts);
    const explicitParent = opts && typeof opts === "object" ? opts.parent : undefined;
    const parent = explicitParent ?? (this as unknown as Node);
    const prepend = opts && typeof opts === "object" ? opts.prepend : false;
    if (parent) {
      if (prepend && (parent as Node).firstChild) {
        (parent as Node).insertBefore(el, (parent as Node).firstChild);
      } else {
        (parent as Node).appendChild(el);
      }
    }
    return el;
  };

  const createDivImpl = function (this: Node, opts?: CreateElOptions | string) {
    return createElImpl.call(this, "div", opts);
  };

  const createSpanImpl = function (this: Node, opts?: CreateElOptions | string) {
    return createElImpl.call(this, "span", opts);
  };

  const emptyImpl = function (this: Node) {
    while (this.firstChild) this.removeChild(this.firstChild);
  };

  const setTextImpl = function (this: Node, value: string) {
    this.textContent = value;
    return this;
  };

  const appendTextImpl = function (this: Node, text: string) {
    this.appendChild(document.createTextNode(text));
    return this;
  };

  const detachImpl = function (this: Node) {
    this.parentNode?.removeChild(this);
  };

  const setAttrImpl = function (this: Element, name: string, value: unknown) {
    if (value === null || value === undefined || value === false) this.removeAttribute(name);
    else this.setAttribute(name, String(value));
    return this;
  };

  const setAttrsImpl = function (this: Element, attrs: Record<string, unknown>) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) this.removeAttribute(name);
      else this.setAttribute(name, String(value));
    }
    return this;
  };

  const getAttrImpl = function (this: Element, name: string) {
    return this.getAttribute(name);
  };

  const addClassImpl = function (this: Element, ...names: string[]) {
    for (const name of names) if (name) this.classList.add(name);
    return this;
  };

  const addClassesImpl = function (this: Element, names: string[]) {
    this.classList.add(...names.filter(Boolean));
    return this;
  };

  const removeClassImpl = function (this: Element, ...names: string[]) {
    for (const name of names) if (name) this.classList.remove(name);
    return this;
  };

  const removeClassesImpl = function (this: Element, names: string[]) {
    this.classList.remove(...names.filter(Boolean));
    return this;
  };

  const toggleClassImpl = function (this: Element, name: string, value?: boolean) {
    this.classList.toggle(name, value);
    return this;
  };

  const hasClassImpl = function (this: Element, name: string) {
    return this.classList.contains(name);
  };

  const elementTargets: Array<object | undefined> = [
    typeof Element !== "undefined" ? Element.prototype : undefined,
    HTMLElement.prototype,
    typeof DocumentFragment !== "undefined" ? DocumentFragment.prototype : undefined,
    typeof ShadowRoot !== "undefined" ? ShadowRoot.prototype : undefined,
    typeof Document !== "undefined" ? Document.prototype : undefined,
  ];

  for (const proto of elementTargets) {
    defineOn(proto, "createEl", createElImpl);
    defineOn(proto, "createDiv", createDivImpl);
    defineOn(proto, "createSpan", createSpanImpl);
    defineOn(proto, "empty", emptyImpl);
    defineOn(proto, "setText", setTextImpl);
    defineOn(proto, "appendText", appendTextImpl);
  }

  const classTargets: Array<object | undefined> = [
    typeof Element !== "undefined" ? Element.prototype : undefined,
    typeof SVGElement !== "undefined" ? SVGElement.prototype : undefined,
    HTMLElement.prototype,
  ];

  for (const proto of classTargets) {
    defineOn(proto, "setAttr", setAttrImpl);
    defineOn(proto, "setAttrs", setAttrsImpl);
    defineOn(proto, "getAttr", getAttrImpl);
    defineOn(proto, "addClass", addClassImpl);
    defineOn(proto, "addClasses", addClassesImpl);
    defineOn(proto, "removeClass", removeClassImpl);
    defineOn(proto, "removeClasses", removeClassesImpl);
    defineOn(proto, "toggleClass", toggleClassImpl);
    defineOn(proto, "hasClass", hasClassImpl);
  }

  if (typeof Node !== "undefined") {
    defineOn(Node.prototype, "detach", detachImpl);
    defineOn(Node.prototype, "empty", emptyImpl);
  }

  defineOn(HTMLElement.prototype, "show", function (this: HTMLElement) {
    this.style.display = "";
    return this;
  });
  defineOn(HTMLElement.prototype, "hide", function (this: HTMLElement) {
    this.style.display = "none";
    return this;
  });
  defineOn(HTMLElement.prototype, "isShown", function (this: HTMLElement) {
    return this.style.display !== "none";
  });
  defineOn(HTMLElement.prototype, "onClickEvent", function (
    this: HTMLElement,
    callback: (event: MouseEvent) => void,
  ) {
    this.addEventListener("click", callback);
    return this;
  });

  if (typeof Element !== "undefined") {
    defineOn(Element.prototype, "matchParent", function (
      this: Element,
      selector: string,
      lastParent?: Element,
    ) {
      let node: Element | null = this;
      while (node && node !== lastParent) {
        if (node.matches?.(selector)) return node;
        node = node.parentElement;
      }
      return null;
    });
  }

  if (typeof String !== "undefined") {
    const stringProto = String.prototype as unknown as Record<string, unknown>;
    if (!("contains" in stringProto)) {
      Object.defineProperty(String.prototype, "contains", {
        value(this: string, search: string) {
          return this.indexOf(search) !== -1;
        },
        writable: true,
        configurable: true,
      });
    }
  }

  if (typeof Array !== "undefined") {
    const arrayProto = Array.prototype as unknown as Record<string, unknown>;
    if (!("first" in arrayProto)) {
      Object.defineProperty(Array.prototype, "first", {
        value(this: unknown[]) {
          return this[0];
        },
        writable: true,
        configurable: true,
      });
    }
    if (!("last" in arrayProto)) {
      Object.defineProperty(Array.prototype, "last", {
        value(this: unknown[]) {
          return this[this.length - 1];
        },
        writable: true,
        configurable: true,
      });
    }
    if (!("remove" in arrayProto)) {
      Object.defineProperty(Array.prototype, "remove", {
        value(this: unknown[], item: unknown) {
          const idx = this.indexOf(item);
          if (idx >= 0) this.splice(idx, 1);
          return this;
        },
        writable: true,
        configurable: true,
      });
    }
  }
}
