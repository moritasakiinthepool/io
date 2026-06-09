const T = 16;

export const WORLD = {
  width: 30 * T,
  height: 22 * T,
  start: { x: 4 * T + 2, y: 5 * T + 2 },
  walls: [
    { x: 0, y: 0, w: 30 * T, h: T },
    { x: 0, y: 21 * T, w: 30 * T, h: T },
    { x: 0, y: 0, w: T, h: 22 * T },
    { x: 29 * T, y: 0, w: T, h: 22 * T },
    { x: 8 * T, y: 5 * T, w: 5 * T, h: T },
    { x: 12 * T, y: 6 * T, w: T, h: 5 * T },
    { x: 18 * T, y: 12 * T, w: 6 * T, h: T },
    { x: 18 * T, y: 13 * T, w: T, h: 4 * T },
  ],
  signs: [
    {
      x: 6 * T,
      y: 4 * T,
      text: [
        "KAIHO ENGINE",
        "This room contains no game content.",
        "Build the new experience from here.",
      ],
    },
  ],
};
