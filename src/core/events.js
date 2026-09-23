// Tiny pub/sub. Gameplay emits, FX/audio/UI listen. Keeps "juice" decoupled from rules.
//
// Events (payloads):
//   grab {mirror}              release {mirror}
//   hover {mirror|null}        rotate {mirror, delta}
//   bounce {point, index, element}   (new bounce point appeared in the path)
//   targetLit {target}         targetUnlit {target}
//   targetCharge {target, charge}
//   targetFull {target, index}  (a puff woke up)
//   levelStart {level, index}  levelClear {level, index}
//   inputSource {source: 'hand'|'mouse'}  handStatus {status, message}

export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.map.get(name).delete(fn);
  }
  emit(name, payload) {
    const set = this.map.get(name);
    if (set) for (const fn of set) fn(payload);
  }
}

export const events = new EventBus();
