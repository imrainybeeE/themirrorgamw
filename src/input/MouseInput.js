// Mouse / touch as a Pointer. Press = pinch. Rotation comes from dragging around the pivot.
export class MouseInput {
  constructor(el) {
    this.pointer = { present: false, sx: 0.5, sy: 0.5, pinching: false, twist: null, pinchAmount: 0, source: 'mouse' };
    this.lastMove = -Infinity;
    const toLocal = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.sx = (e.clientX - r.left) / r.width;
      this.pointer.sy = (e.clientY - r.top) / r.height;
      this.pointer.present = true;
      this.lastMove = performance.now();
    };
    el.addEventListener('pointermove', toLocal);
    el.addEventListener('pointerdown', (e) => {
      toLocal(e);
      el.setPointerCapture?.(e.pointerId);
      this.pointer.pinching = true;
      this.pointer.pinchAmount = 1;
    });
    const up = (e) => {
      this.pointer.pinching = false;
      this.pointer.pinchAmount = 0;
      if (e.pointerType !== 'mouse') this.pointer.present = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (!this.pointer.pinching && e.pointerType === 'mouse') this.pointer.present = false; });
  }
}
