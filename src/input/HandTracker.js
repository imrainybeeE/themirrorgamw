import { ASSETS } from '../config.js';

// Webcam + MediaPipe HandLandmarker. Produces raw landmarks for the latest camera frame.
// The heavy library is imported lazily so mouse-only players never download it.
export class HandTracker {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.landmarks = null; // 21 {x, y, z} in [0,1] image space, or null
    this.handedness = null;
    this.status = 'off'; // off | loading | ready | error
    this.error = null;
  }

  async start(onStatus = () => {}) {
    const set = (s, msg) => { this.status = s; onStatus(s, msg); };
    try {
      set('loading', 'Waking up the camera…');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
      });
      // Safari only plays camera video inline when both are set in code, not just in HTML.
      this.video.muted = true;
      this.video.setAttribute('playsinline', '');
      this.video.srcObject = stream;
      await this.video.play();

      set('loading', 'Teaching the stars about hands…');
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(ASSETS.mediapipeWasm);
      const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: ASSETS.handModel, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      let slow = false;
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');
        slow = true;
      }
      set('ready', slow ? 'Show me your hand! (slow mode)' : 'Show me your hand!');
      return true;
    } catch (err) {
      console.warn('[HandTracker]', err);
      this.error = err;
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      set('error', denied ? 'Camera blocked. Using mouse instead.' : 'Hand tracking unavailable. Using mouse.');
      return false;
    }
  }

  /** Run detection if the camera produced a new frame. Returns true when landmarks were refreshed. */
  poll(nowMs) {
    if (!this.landmarker || this.video.readyState < 2) return false;
    if (this.video.currentTime === this.lastVideoTime) return false;
    this.lastVideoTime = this.video.currentTime;
    const res = this.landmarker.detectForVideo(this.video, nowMs);
    this.landmarks = res.landmarks?.[0] ?? null;
    this.handedness = res.handedness?.[0]?.[0]?.categoryName ?? null;
    return true;
  }
}
