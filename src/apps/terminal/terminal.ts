import { open } from "../../shell/Window/window-manager";

interface Data {
  bio: string[];
  role: string;
  handle: string;
  x: string;
  available: boolean;
  projects: { id: string; name: string; kind: string }[];
  works: { id: string; title: string; client: string; layers: boolean; award: boolean }[];
}

interface Entry { name: string; dir: boolean; href?: string }

const APPS: Record<string, string> = {
  Work: "/work",
  Gallery: "/gallery",
  Layers: "/layers",
  Remix: "/remix",
  Trophies: "/trophies",
  About: "/about",
  Hire: "/hire",
  Contact: "/contact",
  Terminal: "/terminal",
  Trash: "/trash",
};

const COMMANDS = [
  "help", "ls", "cd", "pwd", "open", "cat", "remix", "hire", "contact", "x", "neofetch",
  "whoami", "date", "echo", "history", "clear", "exit", "gm", "wagmi", "sudo", "rm",
];

const HELP: [string, string][] = [
  ["ls [path]", "list a folder"],
  ["cd <path>", "move around (try cd work)"],
  ["open <name>", "open a folder, piece or app"],
  ["cat <file>", "read about.txt, hire.txt or readme.md"],
  ["remix [piece]", "caption a piece and post it"],
  ["hire", "start a commission brief"],
  ["neofetch", "system info"],
  ["clear", "clear the screen (or Ctrl+L)"],
  ["exit", "close Terminal"],
];

const LOGO = [
  "████████  ",
  "██    ██  ",
  "██    ██  ",
  "████████  ",
  "██      ██",
  "██        ",
  "██        ",
];

export function initTerminal(win: HTMLElement) {
  const root = win.querySelector<HTMLElement>("[data-terminal]");
  if (!root) return;
  const out = root.querySelector<HTMLElement>("[data-term-out]")!;
  const input = root.querySelector<HTMLInputElement>("[data-term-input]")!;
  const promptEl = root.querySelector<HTMLElement>("[data-term-prompt]")!;
  const data: Data = JSON.parse(root.querySelector("[data-term-data]")!.textContent!);
  const started = performance.now();

  let cwd: string[] = [];
  const history: string[] = [];
  let hIndex = 0;
  let draft = "";

  const pieceName = (id: string) => `${id.split("/")[1]}.png`;
  const prompt = () => `guest@pizelos ${cwd.length ? "~/" + cwd.join("/") : "~"} %`;

  const el = (tag: string, cls?: string, text?: string) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const print = (...parts: (string | Node)[]) => {
    const line = el("div", "term-row");
    parts.forEach(p => line.append(p));
    out.append(line);
    return line;
  };
  const dim = (t: string) => el("span", "term-dim", t);
  const accent = (t: string) => el("span", "term-accent", t);
  const link = (t: string, href: string, cls = "term-link") => {
    const a = el("a", cls, t) as HTMLAnchorElement;
    a.href = href;
    if (/^https?:/.test(href)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    return a;
  };
  const scroll = () => (root.scrollTop = root.scrollHeight);

  const list = (path: string[]): Entry[] | null => {
    if (path.length === 0) {
      return [
        { name: "Applications", dir: true },
        { name: "work", dir: true, href: "/work" },
        { name: "about.txt", dir: false, href: "/about" },
        { name: "hire.txt", dir: false, href: "/hire" },
        { name: "readme.md", dir: false },
      ];
    }
    if (path.length === 1 && path[0] === "Applications") {
      return Object.entries(APPS).map(([name, href]) => ({ name: `${name}.app`, dir: false, href }));
    }
    if (path[0] === "work") {
      if (path.length === 1) return data.projects.map(p => ({ name: p.id, dir: true, href: `/work/${p.id}` }));
      if (path.length === 2 && data.projects.some(p => p.id === path[1])) {
        return data.works.filter(w => w.id.startsWith(path[1] + "/")).map(w => ({ name: pieceName(w.id), dir: false, href: `/work/${w.id}` }));
      }
    }
    return null;
  };

  const resolve = (arg = ""): string[] | null => {
    const parts = arg.startsWith("~") ? arg.slice(1).split("/") : [...cwd, ...arg.split("/")];
    const outPath: string[] = [];
    for (const p of parts) {
      if (!p || p === ".") continue;
      if (p === "..") outPath.pop();
      else outPath.push(p);
    }
    for (let i = 0; i < outPath.length; i++) {
      const entries = list(outPath.slice(0, i));
      const match = entries?.find(e => e.name === outPath[i]) ?? entries?.find(e => e.name.toLowerCase() === outPath[i].toLowerCase());
      if (!match) return null;
      outPath[i] = match.name;
      if (!match.dir && i < outPath.length - 1) return null;
    }
    return outPath;
  };

  const entryAt = (path: string[]): Entry | null => {
    if (path.length === 0) return { name: "~", dir: true };
    return list(path.slice(0, -1))?.find(e => e.name === path[path.length - 1]) ?? null;
  };

  const find = (query: string): { label: string; href: string } | null => {
    const q = query.toLowerCase().replace(/\.(app|png)$/, "");
    const app = Object.entries(APPS).find(([name]) => name.toLowerCase() === q);
    if (app) return { label: `${app[0]}.app`, href: app[1] };
    const project = data.projects.find(p => p.id === q || p.name.toLowerCase() === q)
      ?? data.projects.find(p => p.id.includes(q) || p.name.toLowerCase().includes(q));
    const work = data.works.find(w => w.id.split("/")[1] === q || w.title.toLowerCase() === q)
      ?? data.works.find(w => w.id.includes(q) || w.title.toLowerCase().includes(q));
    if (project && (!work || project.id.startsWith(q) || project.name.toLowerCase().startsWith(q))) return { label: project.name, href: `/work/${project.id}` };
    if (work) return { label: `${work.title} (${work.client})`, href: `/work/${work.id}` };
    return null;
  };

  const target = (arg: string) => {
    const path = resolve(arg);
    const entry = path && entryAt(path);
    if (path && entry) {
      if (entry.href) return { label: arg, href: entry.href };
      if (path.length === 0) return { label: "~", href: "/work" };
    }
    return find(arg);
  };

  const launch = (label: string, href: string) => {
    print(dim(`Opening ${label}…`));
    open(href);
  };

  const ls = (arg?: string) => {
    const path = arg ? resolve(arg) : cwd;
    const entry = path && entryAt(path);
    if (!path || !entry) return print(`ls: ${arg}: No such file or directory`);
    if (!entry.dir) return print(entry.name);
    const entries = list(path)!;
    const grid = el("div", "term-ls");
    entries.forEach(e => {
      const name = e.dir ? `${e.name}/` : e.name;
      grid.append(e.href ? link(name, e.href, e.dir ? "term-link term-dir" : "term-link") : el("span", e.dir ? "term-dir" : "", name));
    });
    out.append(grid);
  };

  const cat = (arg?: string) => {
    if (!arg) return print("usage: cat <file>");
    const path = resolve(arg);
    const entry = path && entryAt(path);
    if (!path || !entry) return print(`cat: ${arg}: No such file or directory`);
    if (entry.dir) return print(`cat: ${arg}: Is a directory`);
    const name = path.join("/");
    if (name === "about.txt") {
      print(accent(`${data.handle} — ${data.role}`));
      data.bio.forEach(p => print(p));
      return;
    }
    if (name === "hire.txt") {
      print(data.available ? "Status: open for commissions." : "Status: booked up right now, but ask anyway.");
      print("PFPs, banners, meme packs, brand kits. Run ", accent("hire"), " to send a brief.");
      return;
    }
    if (name === "readme.md") {
      print(accent("# PizelOS"));
      print("A portfolio dressed up as a Mac. Everything here is Pizelxx's work.");
      print("Try ", accent("ls work"), ", ", accent("open gallery"), " or ", accent("remix"), ".");
      return;
    }
    print(`cat: ${arg}: binary file. Try `, accent(`open ${arg}`), " instead.");
  };

  const neofetch = () => {
    const clients = data.projects.filter(p => p.kind === "client").length;
    const uptime = Math.round((performance.now() - started) / 60000);
    const info: [string, string][] = [
      ["OS", "PizelOS 27 Golden Gate"],
      ["Host", `${data.handle} · ${data.role}`],
      ["Kernel", "Photoshop"],
      ["Uptime", `${uptime} min${uptime === 1 ? "" : "s"}`],
      ["Pieces", String(data.works.length)],
      ["Clients", String(clients)],
      ["Layered", String(data.works.filter(w => w.layers).length)],
      ["Trophies", String(data.works.filter(w => w.award).length)],
      ["Resolution", `${screen.width}×${screen.height}`],
      ["Glass", document.documentElement.dataset.glass ?? "—"],
    ];
    const wrap = el("div", "term-fetch");
    const logo = el("pre", "term-logo", LOGO.join("\n"));
    const lines = el("div");
    lines.append(el("div", "term-accent", "guest@pizelos"), el("div", "term-dim", "─".repeat(13)));
    info.forEach(([k, v]) => {
      const row = el("div");
      row.append(el("span", "term-accent", `${k}: `), v);
      lines.append(row);
    });
    const swatches = el("div", "term-swatches");
    ["#ff5f57", "#febc2e", "#28c840", "#0a84ff", "#bf5af2", "#ff4fa3", "#3dff8a", "#f5f5f7"].forEach(c => {
      const s = el("span");
      s.style.background = c;
      swatches.append(s);
    });
    lines.append(swatches);
    wrap.append(logo, lines);
    out.append(wrap);
  };

  const run = (raw: string) => {
    const echo = print(el("span", "term-prompt", prompt()), " ", raw);
    echo.classList.add("term-echo");
    const line = raw.trim();
    if (!line) return;
    history.push(line);
    hIndex = history.length;
    const args = (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(a => a.replace(/^["']|["']$/g, ""));
    const cmd = args.shift()!.toLowerCase();
    const rest = args.join(" ");

    switch (cmd) {
      case "help":
        print(accent("PizelOS shell"), dim(" · Tab completes, ↑ ↓ recall history"));
        HELP.forEach(([c, d]) => print(el("span", "term-help-cmd", c), dim(d)));
        break;
      case "ls":
        ls(args.find(a => !a.startsWith("-")));
        break;
      case "cd": {
        if (!rest || rest === "~") {
          cwd = [];
          break;
        }
        const path = resolve(rest);
        const entry = path && entryAt(path);
        if (!path || !entry) print(`cd: no such file or directory: ${rest}`);
        else if (!entry.dir) print(`cd: not a directory: ${rest}`);
        else cwd = path;
        break;
      }
      case "pwd":
        print(`/Users/guest${cwd.length ? "/" + cwd.join("/") : ""}`);
        break;
      case "open": {
        if (!rest) {
          print("usage: open <folder | piece | app>");
          break;
        }
        const t = target(rest);
        if (t) launch(t.label, t.href);
        else print(`The file ${rest} does not exist.`);
        break;
      }
      case "cat":
      case "less":
      case "more":
        cat(args[0]);
        break;
      case "about":
        cat("~/about.txt");
        break;
      case "remix": {
        if (!rest) {
          launch("Remix.app", "/remix");
          break;
        }
        const path = resolve(rest);
        const id = path?.length === 3 && path[0] === "work" ? `${path[1]}/${path[2].replace(/\.png$/, "")}` : null;
        const q = rest.toLowerCase();
        const work = id ? data.works.find(w => w.id === id) : data.works.find(w => w.id.split("/")[1] === q || w.title.toLowerCase().includes(q) || w.id.includes(q));
        if (work) launch(`${work.title} in Remix`, `/remix/${work.id}`);
        else print(`remix: no piece matches "${rest}". Try `, accent("ls work"), ".");
        break;
      }
      case "hire":
        launch("Hire.app", "/hire");
        break;
      case "contact":
        launch("Contact.app", "/contact");
        break;
      case "x":
      case "twitter":
        print("→ ", link(`${data.handle} on X`, data.x));
        window.open(data.x, "_blank", "noopener");
        break;
      case "neofetch":
      case "fastfetch":
        neofetch();
        break;
      case "whoami":
        print("guest");
        print(dim("but you could be a client. Try "), accent("hire"), dim("."));
        break;
      case "date":
        print(new Date().toString().replace(/\s\(.+\)$/, ""));
        break;
      case "echo":
        print(rest);
        break;
      case "history":
        history.forEach((h, i) => print(dim(String(i + 1).padStart(4, " ") + "  "), h));
        break;
      case "clear":
        out.replaceChildren();
        break;
      case "exit":
      case "logout":
        print("[Process completed]");
        setTimeout(() => win.querySelector<HTMLElement>('[data-window-action="close"]')?.click(), 250);
        break;
      case "gm":
        print("gm ser ☀️");
        break;
      case "gn":
        print("gn. ship something tomorrow 🌙");
        break;
      case "wagmi":
        print("we're all gonna make it 🤝");
        break;
      case "ngmi":
        print("not with that attitude. Run ", accent("open gallery"), " for inspo.");
        break;
      case "sudo":
        print("guest is not in the sudoers file. This incident will be reported to @Pizelxx.");
        break;
      case "rm":
        print(/-\w*r\w*f|-\w*f\w*r/.test(rest) ? "Nice try. Drag things to the Trash like everyone else." : "rm: permission denied. These pieces are staying.");
        break;
      case "vim":
      case "nano":
      case "emacs":
        print(`${cmd}: read-only system. Photoshop is the only editor here.`);
        break;
      default:
        if (APPS[cmd.charAt(0).toUpperCase() + cmd.slice(1)]) {
          const name = cmd.charAt(0).toUpperCase() + cmd.slice(1);
          launch(`${name}.app`, APPS[name]);
        } else {
          print(`zsh: command not found: ${cmd}`);
        }
    }
  };

  const complete = () => {
    const value = input.value;
    const tokens = value.split(/\s+/);
    const last = tokens[tokens.length - 1];
    let options: string[];
    let prefix: string;
    let base = "";
    if (tokens.length === 1) {
      prefix = last;
      options = COMMANDS.filter(c => c.startsWith(prefix.toLowerCase()));
    } else {
      const slash = last.lastIndexOf("/");
      base = slash >= 0 ? last.slice(0, slash + 1) : "";
      prefix = last.slice(slash + 1);
      const dir = resolve(base || ".");
      const entries = dir && entryAt(dir)?.dir ? list(dir) ?? [] : [];
      options = entries.filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase())).map(e => e.name + (e.dir ? "/" : ""));
    }
    if (!options.length) return;
    const common = options.reduce((a, b) => {
      let i = 0;
      while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
      return a.slice(0, i);
    });
    const single = options.length === 1;
    const replacement = base + (single ? options[0] + (options[0].endsWith("/") ? "" : " ") : common);
    if (replacement !== last) {
      tokens[tokens.length - 1] = replacement;
      input.value = tokens.join(" ");
    } else if (!single) {
      print(el("span", "term-prompt", prompt()), " ", value);
      const grid = el("div", "term-ls");
      options.forEach(o => grid.append(el("span", o.endsWith("/") ? "term-dir" : "", o)));
      out.append(grid);
      scroll();
    }
  };

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input.value);
      input.value = "";
      draft = "";
      promptEl.textContent = prompt();
      scroll();
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hIndex === history.length) draft = input.value;
      if (hIndex > 0) input.value = history[--hIndex];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIndex < history.length) {
        hIndex++;
        input.value = hIndex === history.length ? draft : history[hIndex];
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      out.replaceChildren();
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      if (input.selectionStart !== input.selectionEnd) return;
      e.preventDefault();
      print(el("span", "term-prompt", prompt()), " ", input.value, "^C");
      input.value = "";
      scroll();
    }
  });

  root.addEventListener("pointerup", e => {
    if ((e.target as HTMLElement).closest("a") || getSelection()?.toString()) return;
    input.focus({ preventScroll: true });
  });

  const login = new Date().toString().slice(0, 24);
  print(dim(`Last login: ${login} on ttys000`));
  print("Welcome to PizelOS 27. Type ", accent("help"), " to get started.");
  promptEl.textContent = prompt();
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}
