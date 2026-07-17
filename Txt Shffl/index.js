import { ANIMATIONS, DIRECTIONS } from "./constants.js";
import { shuffle } from "./textShuffle.js";
import { shuffleScroll } from "./textShuffleScroll.js";
import { wave } from "./textWave.js";
import { glitch } from "./textGlitch.js";
import { typewriter } from "./textTypewriter.js";
import { morph } from "./textMorph.js";
import { spotlight } from "./textSpotlight.js";

// Same public names the original module exported (`animations`,
// `directions`, lowercase), still pointing at the same two effects
// it always did, plus five new ones alongside them. Both a named
// export (`import { shuffle } from "text-shuffle"`) and a default
// export (`import textShuffle from "text-shuffle"`) work, since ESM
// consumers commonly expect one or the other depending on taste.
export { ANIMATIONS as animations, DIRECTIONS as directions };
export { shuffle, shuffleScroll, wave, glitch, typewriter, morph, spotlight };

export default {
  animations: ANIMATIONS,
  directions: DIRECTIONS,
  shuffle,
  shuffleScroll,
  wave,
  glitch,
  typewriter,
  morph,
  spotlight,
};
