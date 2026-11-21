export const glyph = {
  folder: `<path d="M2.5 5.2c0-1 .8-1.7 1.7-1.7h3l1.4 1.5h5.2c1 0 1.7.8 1.7 1.7v6c0 1-.8 1.8-1.7 1.8H4.2c-1 0-1.7-.8-1.7-1.8Z"/>`,
  grid: `<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>`,
  layers: `<path d="M8 2.5 14 5.5 8 8.5 2 5.5Z"/><path d="M2 8.2 8 11.2l6-3"/><path d="M2 10.9 8 13.9l6-3"/>`,
  trophy: `<path d="M5 2.5h6v3.2c0 1.9-1.3 3.3-3 3.3S5 7.6 5 5.7Z"/><path d="M5 3.8H3c0 1.9 1 2.9 2.2 3M11 3.8h2c0 1.9-1 2.9-2.2 3M8 9v2.5M5.5 13.5h5"/>`,
  person: `<circle cx="8" cy="5.5" r="2.8"/><path d="M2.8 13.8c.6-2.6 2.7-4 5.2-4s4.6 1.4 5.2 4"/>`,
  mail: `<rect x="2" y="3.5" width="12" height="9" rx="2"/><path d="m2.6 4.6 5.4 4.2 5.4-4.2"/>`,
  trash: `<path d="M3 4.5h10M6.2 4.5V3h3.6v1.5M4.3 4.5l.7 8.5c.1.8.7 1.3 1.4 1.3h3.2c.7 0 1.3-.5 1.4-1.3l.7-8.5"/>`,
  back: `<path d="M10 3 5 8l5 5"/>`,
  forward: `<path d="m6 3 5 5-5 5"/>`,
  info: `<circle cx="8" cy="8" r="6"/><path d="M8 7.3v4M8 4.9v.1"/>`,
  search: `<circle cx="7" cy="7" r="4.3"/><path d="m10.3 10.3 3.2 3.2"/>`,
  play: `<path d="M5 3.3v9.4L12.5 8Z"/>`,
  eye: `<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>`,
  external: `<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h3"/>`,
  x: `<path d="M2.5 2.5h3.3l2.6 3.6 3.1-3.6h1.4L9 6.8l4.5 6.7h-3.3L7.4 9.6 4.1 13.5H2.6l4.1-4.7Z" fill="currentColor" stroke="none"/>`,
  send: `<path d="M2.5 7.5 13.5 2.5 9.5 13.5 7.8 8.8Z"/><path d="m7.8 8.8 5.7-6.3"/>`,
  star: `<path d="m8 2.3 1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1 4.5 13l.8-3.9-2.9-2.7 3.9-.5Z"/>`,
  sidebar: `<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M6 3v10"/>`,
};

export const svg = (name: keyof typeof glyph) => `<svg viewBox="0 0 16 16" aria-hidden="true">${glyph[name]}</svg>`;
