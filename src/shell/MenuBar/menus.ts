export type MenuItem =
  | { type: "separator" }
  | {
      type?: "item";
      label: string;
      shortcut?: string;
      href?: string;
      external?: boolean;
      action?: string;
      disabled?: boolean;
    };

export interface MenuDef {
  id: string;
  label: string;
  bold?: boolean;
  items: MenuItem[];
}

export const systemMenu: MenuDef = {
  id: "system",
  label: "Pizelxx",
  items: [
    { label: "About Pizelxx", href: "/about" },
    { type: "separator" },
    { label: "Follow on X…", href: "https://x.com/Pizelxx", external: true },
    { label: "Hire Pizelxx…", href: "/hire" },
    { type: "separator" },
    { label: "Recent Work", href: "/work" },
    { type: "separator" },
    { label: "Lock Screen", shortcut: "⌃⌘Q", action: "lock" },
  ],
};

export const appMenus: MenuDef[] = [
  {
    id: "app",
    label: "Pizelxx",
    bold: true,
    items: [
      { label: "About This Portfolio", href: "/about" },
      { type: "separator" },
      { label: "Settings…", shortcut: "⌘,", disabled: true },
      { type: "separator" },
      { label: "Hide Others", shortcut: "⌥⌘H", disabled: true },
      { label: "Show All", disabled: true },
    ],
  },
  {
    id: "file",
    label: "File",
    items: [
      { label: "New Window", shortcut: "⌘N", href: "/work" },
      { label: "Open…", shortcut: "⌘O", href: "/work" },
      { type: "separator" },
      { label: "Close Window", shortcut: "⌘W", action: "close-window" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "⌘Z", disabled: true },
      { label: "Redo", shortcut: "⇧⌘Z", disabled: true },
      { type: "separator" },
      { label: "Copy Link", shortcut: "⌘C", action: "copy-link" },
      { label: "Select All", shortcut: "⌘A", disabled: true },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { label: "as Icons", shortcut: "⌘1", disabled: true },
      { label: "as List", shortcut: "⌘2", disabled: true },
      { label: "as Gallery", shortcut: "⌘4", href: "/gallery" },
      { type: "separator" },
      { label: "Enter Full Screen", shortcut: "⌃⌘F", action: "fullscreen" },
    ],
  },
  {
    id: "go",
    label: "Go",
    items: [
      { label: "Work", shortcut: "⇧⌘W", href: "/work" },
      { label: "Gallery", shortcut: "⇧⌘G", href: "/gallery" },
      { label: "Layers", shortcut: "⇧⌘L", href: "/layers" },
      { label: "Trophies", shortcut: "⇧⌘T", href: "/trophies" },
      { label: "Remix", shortcut: "⇧⌘R", href: "/remix" },
      { type: "separator" },
      { label: "About", shortcut: "⇧⌘A", href: "/about" },
      { label: "Contact", shortcut: "⇧⌘C", href: "/contact" },
      { label: "Hire", shortcut: "⇧⌘H", href: "/hire" },
      { type: "separator" },
      { label: "Terminal", shortcut: "⌥⌘T", href: "/terminal" },
    ],
  },
  {
    id: "window",
    label: "Window",
    items: [
      { label: "Minimize", shortcut: "⌘M", action: "minimize-window" },
      { label: "Zoom", action: "zoom-window" },
      { type: "separator" },
      { label: "Bring All to Front", disabled: true },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [
      { label: "Pizelxx Help", href: "/about" },
      { label: "Message on X…", href: "https://x.com/Pizelxx", external: true },
    ],
  },
];
