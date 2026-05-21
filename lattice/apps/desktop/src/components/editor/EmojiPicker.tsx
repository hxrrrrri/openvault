import { useMemo, useState } from "react";

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
  maxHeight?: number;
}

const CATEGORIES: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
      "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫",
      "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
      "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🥵",
      "🥶", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟",
      "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰",
      "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫",
      "🥱", "😤", "😡", "😠", "🤬",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
      "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝",
      "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👂",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️",
    ],
  },
  {
    label: "Nature",
    emojis: [
      "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁",
      "🍂", "🍃", "🌺", "🌻", "🌼", "🌷", "🌹", "🥀", "💐", "🌸",
      "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑",
      "🌒", "🌓", "🌔", "⭐", "🌟", "💫", "✨", "☄️", "🌈", "☀️",
      "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️",
      "🔥", "💧", "🌊", "🌍", "🌎", "🌏",
    ],
  },
  {
    label: "Food",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈",
      "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦",
      "🥬", "🥒", "🌶️", "🌽", "🥕", "🥔", "🍠", "🥐", "🍞", "🥖",
      "🥨", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🍔", "🍟", "🍕",
      "🌭", "🥪", "🌮", "🌯", "🥙", "🥗", "🍝", "🍜", "🍲", "🍣",
      "🍱", "🥟", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🍢", "🍡",
      "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫",
      "🍬", "🍭", "🍮", "🍯", "☕", "🍵", "🥤", "🧃", "🧉", "🧊",
      "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🍾",
    ],
  },
  {
    label: "Activity",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
      "🏓", "🏸", "🥅", "🏒", "🏑", "🥍", "🏏", "🥌", "⛳", "🪁",
      "🎯", "🎮", "🎰", "🎲", "🧩", "🎼", "🎤", "🎧", "🎷", "🎺",
      "🎸", "🎻", "🥁", "🎬", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️",
    ],
  },
  {
    label: "Tech",
    emojis: [
      "💻", "🖥️", "🖨️", "⌨️", "🖱️", "💾", "💿", "📀", "📷", "📸",
      "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻",
      "🎙️", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🧯", "🛢️", "💸",
      "💵", "💴", "💶", "💷", "💰", "💳", "💎",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "📚", "📖", "📕", "📗", "📘", "📙", "📔", "📓", "📒", "📃",
      "📜", "📄", "📰", "🗞️", "📑", "🔖", "🏷️", "💼", "📁", "📂",
      "🗂️", "📅", "📆", "🗓️", "📇", "📈", "📉", "📊", "📋", "📌",
      "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒",
      "🔓", "🔏", "🔐", "🔑", "🗝️", "🔨", "⛏️", "⚒️", "🛠️", "🗡️",
      "⚔️", "🔫", "🪃", "🏹", "🛡️", "🪚", "🔧", "🔩", "⚙️", "🗜️",
      "⚖️", "🦯", "🔗", "⛓️", "🪝", "🧰", "🧲",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "✅", "❌", "❎", "✔️", "☑️", "🆗", "🆕", "🆙", "🆒", "🆓",
      "🔥", "⚡", "🎉", "🎊", "🎁", "🎈", "💯", "💢", "💥", "💫",
      "💦", "💨", "🕳️", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "🌀",
      "⚛️", "🕉️", "✡️", "☸️", "☯️", "✝️", "☦️", "☪️", "☮️", "🕎",
      "🔯", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐",
      "♑", "♒", "♓", "⛎",
    ],
  },
];

export function EmojiPicker({ onPick, onClose, maxHeight = 470 }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CATEGORIES[active].emojis;
    const matches = CATEGORIES.filter((cat) => cat.label.toLowerCase().includes(normalized));
    return (matches.length ? matches : CATEGORIES).flatMap((cat) => cat.emojis).slice(0, 96);
  }, [active, query]);

  return (
    <div
      className="anim-fade-up flex w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl bg-[#0b0b12] shadow-[0_28px_90px_rgba(0,0,0,0.78),inset_0_0_0_1px_rgba(139,124,255,0.18)]"
      style={{ maxHeight }}
    >
      <div className="border-b border-[#25213d] bg-[#14141d] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[var(--text)]">Emoji</div>
            <div className="mono mt-0.5 text-[10px] text-[var(--text-4)]">insert into note</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mono grid h-7 min-w-8 place-items-center rounded-md px-2 text-[10px] text-[var(--text-3)] transition hover:bg-violet/15 hover:text-[var(--text)]"
            title="Close emoji picker"
          >
            ESC
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories..."
          className="w-full rounded-lg border-transparent bg-[#08080d] px-3 py-2 text-xs text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.1)] placeholder:text-[var(--text-4)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.32)]"
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="w-24 shrink-0 overflow-y-auto pr-1">
            {CATEGORIES.map((cat, index) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  setActive(index);
                  setQuery("");
                }}
                className={`mb-1 block w-full truncate rounded-md px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.08em] transition ${
                  active === index && !query
                    ? "bg-violet/20 text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.22)]"
                    : "text-[var(--text-3)] hover:bg-violet/10 hover:text-[var(--text-2)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-6 content-start gap-1.5 overflow-y-auto overscroll-contain pr-1">
            {filtered.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => {
                  onPick(emoji);
                  onClose();
                }}
                className="grid size-9 place-items-center rounded-lg text-xl transition hover:bg-violet/15 hover:shadow-[inset_0_0_0_1px_rgba(139,124,255,0.18)]"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
