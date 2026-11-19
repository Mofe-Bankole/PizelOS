export interface AppDef {
  id: string;
  name: string;
  href?: string;
  external?: boolean;
  gradient: [string, string];
  glyph: string;
  glyphColor?: string;
}

export const apps: AppDef[] = [
  {
    id: "work",
    name: "Work",
    href: "/work",
    gradient: ["#5ec8ff", "#1677f2"],
    glyph: `<path d="M24 36c0-3.3 2.7-6 6-6h12l5 5h23c3.3 0 6 2.7 6 6v25c0 3.3-2.7 6-6 6H30c-3.3 0-6-2.7-6-6Z" fill="#fff" fill-opacity=".28"/>
      <path d="M24 42c0-3.3 2.7-6 6-6h40c3.3 0 6 2.7 6 6v24c0 3.3-2.7 6-6 6H30c-3.3 0-6-2.7-6-6Z" fill="#fff"/>
      <path d="M42 46h8v4h4v-4h4v8h-4v4h-4v4h-8Z" fill="#1677f2"/>`,
  },
  {
    id: "gallery",
    name: "Gallery",
    href: "/gallery",
    gradient: ["#ffb36b", "#ff3d7f"],
    glyph: `<rect x="30" y="26" width="44" height="44" rx="9" fill="#fff" fill-opacity=".35" transform="rotate(8 52 48)"/>
      <rect x="25" y="30" width="46" height="46" rx="9" fill="#fff"/>
      <circle cx="38" cy="43" r="5" fill="#ff8a4c"/>
      <path d="M29 70l14-14 9 9 7-7 10 10v2c0 1.7-1.3 3-3 3H32c-1.7 0-3-1.3-3-3Z" fill="#ff3d7f"/>`,
  },
  {
    id: "layers",
    name: "Layers",
    href: "/layers",
    gradient: ["#3b3f8f", "#141633"],
    glyph: `<path d="M50 62 22 50l28-12 28 12Z" fill="#6c7bff" fill-opacity=".55"/>
      <path d="M50 54 22 42l28-12 28 12Z" fill="#9aa6ff" fill-opacity=".8"/>
      <path d="M50 46 22 34l28-12 28 12Z" fill="#fff"/>
      <path d="M22 58l28 12 28-12" fill="none" stroke="#c9d0ff" stroke-width="3" stroke-linejoin="round" stroke-opacity=".7"/>`,
  },
  {
    id: "trophies",
    name: "Trophies",
    href: "/trophies",
    gradient: ["#ffe27a", "#f39b12"],
    glyph: `<path d="M36 26h28v14c0 9-6 16-14 16s-14-7-14-16Z" fill="#fff"/>
      <path d="M36 30h-8c0 9 5 14 10 14M64 30h8c0 9-5 14-10 14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <rect x="46" y="55" width="8" height="9" fill="#fff"/>
      <rect x="37" y="64" width="26" height="8" rx="3" fill="#fff"/>
      <path d="M50 32l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="#f5a623"/>`,
  },
  {
    id: "about",
    name: "About",
    href: "/about",
    gradient: ["#fbf6ec", "#e6dccb"],
    glyph: `<circle cx="50" cy="38" r="12" fill="#2b2b35"/>
      <path d="M28 74c2-12 11-19 22-19s20 7 22 19Z" fill="#2b2b35"/>
      <circle cx="68" cy="30" r="6" fill="#ff5a8a"/>`,
  },
  {
    id: "contact",
    name: "Contact",
    href: "/contact",
    gradient: ["#4fe3a8", "#0e9f8a"],
    glyph: `<path d="M24 48 74 26 62 74 50 58Z" fill="#fff"/>
      <path d="M50 58 74 26 44 52Z" fill="#cfeee5"/>
      <path d="M44 52l6 6-4 10Z" fill="#a8dccd"/>`,
  },
  {
    id: "x",
    name: "Pizelxx on X",
    href: "https://x.com/Pizelxx",
    external: true,
    gradient: ["#2a2a2e", "#050506"],
    glyph: `<path d="M30 28h11l10 13.5L63 28h6L54 44.6 71 72H60L49 57.2 36 72h-6l16-18.4Z" fill="#fff"/>`,
  },
];

export const trash: AppDef = {
  id: "trash",
  name: "Trash",
  gradient: ["rgba(255,255,255,.55)", "rgba(255,255,255,.18)"],
  glyph: `<path d="M30 30h40l-4 44c-.3 3-2.8 5-5.8 5H39.8c-3 0-5.5-2-5.8-5Z" fill="#fff" fill-opacity=".5" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>
    <rect x="27" y="25" width="46" height="7" rx="3.5" fill="#fff" fill-opacity=".85"/>
    <path d="M42 40v30M50 40v30M58 40v30" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`,
};
