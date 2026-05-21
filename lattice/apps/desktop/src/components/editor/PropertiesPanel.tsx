import { Calendar, CheckSquare, ChevronDown, Hash, Link2, List, Plus, Type, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  inferType,
  parseProperties,
  serializeProperties,
  type PropertyEntry,
  type PropertyValue,
} from "@/lib/markdown-properties";

type PropertyType = "text" | "list" | "number" | "checkbox" | "date" | "datetime";

interface PropertiesPanelProps {
  content: string;
  onChange: (next: string) => void;
}

export function PropertiesPanel({ content, onChange }: PropertiesPanelProps) {
  const parsed = useMemo(() => parseProperties(content), [content]);

  function update(properties: PropertyEntry[]) {
    onChange(serializeProperties(properties, parsed.body));
  }

  function updateEntry(index: number, patch: Partial<PropertyEntry>) {
    const next = [...parsed.properties];
    next[index] = { ...next[index], ...patch };
    update(next);
  }

  function changeType(index: number, newType: PropertyType) {
    const current = parsed.properties[index];
    let value: PropertyValue;
    switch (newType) {
      case "list":
        value = Array.isArray(current.value)
          ? current.value
          : current.value === null
          ? []
          : [String(current.value)];
        break;
      case "number":
        value = typeof current.value === "number" ? current.value : Number(current.value) || 0;
        break;
      case "checkbox":
        value = Boolean(current.value);
        break;
      case "date":
        value = typeof current.value === "string" ? current.value.slice(0, 10) : new Date().toISOString().slice(0, 10);
        break;
      case "datetime":
        value = typeof current.value === "string" && current.value.length >= 16
          ? current.value.slice(0, 16)
          : new Date().toISOString().slice(0, 16);
        break;
      default:
        value = Array.isArray(current.value) ? current.value.join(", ") : current.value === null ? "" : String(current.value);
    }
    updateEntry(index, { value });
  }

  function removeEntry(index: number) {
    update(parsed.properties.filter((_, i) => i !== index));
  }

  function addEntry() {
    let key = "new-property";
    let i = 1;
    while (parsed.properties.some((entry) => entry.key === key)) {
      key = `new-property-${i++}`;
    }
    update([...parsed.properties, { key, value: "" }]);
  }

  return (
    <div className="border-b border-[var(--border)]/40 bg-[#0a0a0e]/30 px-10 pb-3 pt-4">
      <div className="pixel-label mb-2 text-[10px]">Properties</div>
      <div className="space-y-1.5">
        {parsed.properties.map((entry, index) => (
          <PropertyRow
            key={`${entry.key}:${index}`}
            entry={entry}
            type={inferType(entry.value)}
            onKeyChange={(key) => updateEntry(index, { key })}
            onValueChange={(value) => updateEntry(index, { value })}
            onTypeChange={(type) => changeType(index, type)}
            onRemove={() => removeEntry(index)}
          />
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[var(--text-3)] transition hover:bg-violet/10 hover:text-white"
        >
          <Plus size={11} /> Add property
        </button>
      </div>
    </div>
  );
}

function PropertyRow({
  entry,
  type,
  onKeyChange,
  onValueChange,
  onTypeChange,
  onRemove,
}: {
  entry: PropertyEntry;
  type: PropertyType;
  onKeyChange: (key: string) => void;
  onValueChange: (value: PropertyValue) => void;
  onTypeChange: (type: PropertyType) => void;
  onRemove: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const Icon = TYPE_ICONS[type];
  return (
    <div className="group grid grid-cols-[180px_24px_1fr_24px] items-center gap-2">
      <input
        value={entry.key}
        onChange={(event) => onKeyChange(event.currentTarget.value)}
        className="rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => setTypeOpen((o) => !o)}
          className="grid size-6 place-items-center rounded text-[var(--text-3)] transition hover:bg-violet/15 hover:text-white"
          title={`Type: ${type}`}
        >
          <Icon size={11} />
        </button>
        {typeOpen && (
          <div className="absolute left-0 top-7 z-30 w-32 rounded-md border border-[var(--border)] bg-[#0c0c12]/95 py-1 text-xs shadow-lg">
            {(Object.keys(TYPE_ICONS) as PropertyType[]).map((option) => {
              const OptionIcon = TYPE_ICONS[option];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onTypeChange(option);
                    setTypeOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-[var(--text-2)] hover:bg-violet/15 hover:text-white"
                >
                  <OptionIcon size={11} />
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <ValueEditor type={type} value={entry.value} onChange={onValueChange} />
      <button
        type="button"
        onClick={onRemove}
        className="grid size-6 place-items-center rounded text-[var(--text-4)] opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-300"
        title="Remove property"
      >
        <X size={11} />
      </button>
    </div>
  );
}

const TYPE_ICONS: Record<PropertyType, typeof Type> = {
  text: Type,
  list: List,
  number: Hash,
  checkbox: CheckSquare,
  date: Calendar,
  datetime: Calendar,
};

function ValueEditor({
  type,
  value,
  onChange,
}: {
  type: PropertyType;
  value: PropertyValue;
  onChange: (value: PropertyValue) => void;
}) {
  if (type === "checkbox") {
    return (
      <button
        type="button"
        aria-pressed={Boolean(value)}
        className={`toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
      />
    );
  }
  if (type === "list") {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <span
            key={`${item}:${index}`}
            className="flex items-center gap-1 rounded bg-violet/15 px-1.5 py-0.5 text-[11px] text-[var(--text-2)]"
          >
            {item}
            <button
              type="button"
              className="text-[var(--text-4)] hover:text-rose-300"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          placeholder="Add…"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              const text = event.currentTarget.value.trim().replace(/,$/, "");
              if (text) onChange([...items, text]);
              event.currentTarget.value = "";
            }
          }}
          className="flex-1 rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
        />
      </div>
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
      />
    );
  }
  if (type === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
      />
    );
  }
  if (type === "datetime") {
    return (
      <input
        type="datetime-local"
        value={typeof value === "string" ? value.slice(0, 16) : ""}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
      />
    );
  }
  return (
    <input
      value={value === null ? "" : String(value)}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="w-full rounded-md bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none focus:bg-black/30"
    />
  );
}

// Suppress unused warnings on lucide icons referenced via map
void ChevronDown;
void Link2;
