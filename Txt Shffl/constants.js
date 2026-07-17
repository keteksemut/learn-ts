export const DIRECTIONS = {
  RIGHT: "right",
  LEFT: "left",
  RANDOM: "random",
  CENTER_OUT: "center-out",
  EDGES_IN: "edges-in",
  WORD_BY_WORD: "word-by-word",
};

export const ANIMATIONS = {
  SHOW: "show",
  HIDE: "hide",
  STAY: "stay",
};

// Shared by shuffle, wave, glitch, typewriter, and spotlight.
// shuffleScroll keeps its own richer default — that split already
// existed before this file had more than one consumer to share it.
export const DEFAULT_GLYPHS =
  " !#$&%()*+0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuüvwxyz{|}~";
