export interface WindowSize {
  w: number;
  h: number;
  minW: number;
  minH: number;
}

export const windowSizes: Record<string, WindowSize> = {
  work: { w: 920, h: 580, minW: 520, minH: 340 },
  preview: { w: 1040, h: 680, minW: 520, minH: 380 },
  gallery: { w: 1080, h: 700, minW: 520, minH: 380 },
  layers: { w: 1100, h: 700, minW: 640, minH: 440 },
  trophies: { w: 780, h: 540, minW: 440, minH: 320 },
  about: { w: 780, h: 520, minW: 480, minH: 320 },
  contact: { w: 640, h: 540, minW: 420, minH: 380 },
  trash: { w: 560, h: 380, minW: 360, minH: 260 },
  notfound: { w: 520, h: 320, minW: 360, minH: 260 },
};

export const routeApps = ["work", "gallery", "layers", "trophies", "about", "contact", "trash"];
