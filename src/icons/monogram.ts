export const MONOGRAM = {
  size: 16,
  letter: "M3 1.5h7.25A3.75 3.75 0 0 1 14 5.25 3.75 3.75 0 0 1 10.25 9H6.5v5.5H3Zm3.5 3V6h3.5a.75.75 0 0 0 0-1.5Z",
  pixel: { x: 11, y: 11.5, size: 3, radius: 0.6 },
};

export const monogramPaths = () => [
  MONOGRAM.letter,
  `M${MONOGRAM.pixel.x} ${MONOGRAM.pixel.y}h${MONOGRAM.pixel.size}v${MONOGRAM.pixel.size}h-${MONOGRAM.pixel.size}Z`,
];
