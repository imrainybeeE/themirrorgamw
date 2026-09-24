// Everything the voices say. Edit freely; {n} = level number, {name} = level name.
// Kept free of browser APIs so it can be unit tested.

export const LINES = {
  levelStart: { who: 'narrator', lines: ['Level {n}. {name}!'] },
  levelClear: { who: 'narrator', lines: ['Wonderful!', 'Sparkly!', 'Hooray!', 'So bright!', 'Puff-tastic!', 'Beautiful bounce!'] },
  gameComplete: { who: 'narrator', lines: ['Everyone is awake! You filled the sky with light.'] },
  puffLit: { who: 'puff', lines: ['Mmm... five more minutes.', 'Who turned on the light?', 'So... warm...', 'Hmm? Is it morning?'] },
  puffWake: { who: 'puff', lines: ["I'm awake!", 'Yay, sunshine!', 'Wheee!', 'Good morning!', 'Hello, light!'] },
  puffSleep: { who: 'puff', lines: ['Aww...', 'Zzz...', 'Sleepy again...'] },
};

/** Fill {n} / {name} placeholders. */
export function fill(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}

/**
 * Picks lines without repeating the previous one of the same kind.
 * `rand` is injectable so tests (and the video capture) can be deterministic.
 */
export class LinePicker {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.last = new Map();
  }
  pick(kind, vars) {
    const set = LINES[kind];
    if (!set) return null;
    const { lines } = set;
    let i = Math.floor(this.rand() * lines.length);
    if (lines.length > 1 && i === this.last.get(kind)) i = (i + 1) % lines.length;
    this.last.set(kind, i);
    return { who: set.who, text: fill(lines[i], vars) };
  }
}
