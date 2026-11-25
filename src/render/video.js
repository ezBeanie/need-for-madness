// A replay recorded as a video file: the race as drawn (not the controls over it, those are
// on the other canvas), with its sounds and music, as WebM (or MP4 where the browser records
// only that). Each frame drawn goes into the video, scaled to 1080 lines (the classic look's
// few pixels kept sharp); the video runs as the replay plays, in real time.

import { audioStream, stopAudioStream } from "../audio/audio.js";
import { canvas3D } from "./renderer.js";

// what the browser records, the best first: [type, file extension]
const TYPES = [
  ["video/webm;codecs=vp9,opus", "webm"],
  ["video/webm;codecs=vp8,opus", "webm"],
  ["video/webm", "webm"],
  ["video/mp4", "mp4"],
];
const HEIGHT = 1080;
const BITS_PER_SECOND = 12_000_000;
// without frames asked for one by one, as many a second
const FRAMES_PER_SECOND = 60;

export const videoType = () =>
  typeof MediaRecorder == "undefined" ||
  typeof HTMLCanvasElement.prototype.captureStream != "function"
    ? null
    : (TYPES.find(([type]) => MediaRecorder.isTypeSupported(type)) ?? null);

// recording: whether a video is being recorded, since when (performance.now())
export const video = { recording: false, since: 0 };

let recorder = null;
let frames = null;
let track = null;

// Starts a video; done(blob, extension) once it is stopped.
export const startVideo = (done) => {
  const [type, extension] = videoType();
  frames = document.createElement("canvas");
  frames.height = HEIGHT;
  frames.width =
    2 * Math.round((HEIGHT * canvas3D.width) / canvas3D.height / 2);
  let stream = frames.captureStream(0);
  [track] = stream.getVideoTracks();
  if (typeof track.requestFrame != "function") {
    track.stop();
    stream = frames.captureStream(FRAMES_PER_SECOND);
    [track] = stream.getVideoTracks();
  }
  for (const sound of audioStream()?.getAudioTracks() ?? []) {
    stream.addTrack(sound);
  }
  const chunks = [];
  recorder = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: BITS_PER_SECOND,
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.onstop = () => {
    stopAudioStream();
    for (const each of stream.getTracks()) {
      each.stop();
    }
    done(new Blob(chunks, { type: type.split(";")[0] }), extension);
  };
  recorder.start(1000);
  video.recording = true;
  video.since = performance.now();
};

// Every frame the race was drawn, while recording: its picture into the video.
export const recordVideoFrame = () => {
  if (!video.recording) {
    return;
  }
  const context = frames.getContext("2d");
  context.imageSmoothingEnabled = canvas3D.style.imageRendering != "pixelated";
  context.drawImage(canvas3D, 0, 0, frames.width, frames.height);
  track.requestFrame?.();
};

export const stopVideo = () => {
  if (video.recording) {
    video.recording = false;
    recorder.stop();
  }
};
