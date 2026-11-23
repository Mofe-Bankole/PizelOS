import raw from "../../public/twitter/logo.svg?raw";

export const X_VIEWBOX = raw.match(/viewBox="([^"]+)"/)![1];
export const X_PATH = raw.match(/\sd="([^"]+)"/)![1];

export const xLogo = (attrs = "", fill = "currentColor") =>
  `<svg ${attrs} viewBox="${X_VIEWBOX}" aria-hidden="true"><path d="${X_PATH}" fill="${fill}"/></svg>`;
