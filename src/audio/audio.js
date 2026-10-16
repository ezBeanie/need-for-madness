// Music (one menu track, one track per stage), sound effects and the looping engine sound.
// Browsers only play audio after the player touched the page: see unlockAudio.

import { isIos } from "../core/platform.js";

export const audio = { muteMusic: false, muteSound: false };

// The engine sound of the player's car; the game adjusts its pitch and volume while driving.
export const engine = { started: false, source: null, volume: null };

let unlocked = false;

// Music tracks: state 0 = never played, 1 = playing, 2 = paused.
const menuMusic = {
  track: null,
  state: 0,
  pendingPlay: false,
  firstPlay: true,
};
const stageMusic = { track: null, state: 0, pendingPlay: false, stage: -1 };

export const playMenuMusic = () => {
  try {
    if (menuMusic.state == 0) {
      menuMusic.track = new Audio("data/music/shift.mp3");
      menuMusic.track.volume = 1;
      menuMusic.track.loop = true;
    }
    menuMusic.track.volume = 0.6;
    // iOS only starts the first play from within a touch (see unlockAudio)
    if (unlocked && !audio.muteMusic && (!isIos || !menuMusic.firstPlay)) {
      menuMusic.track.play();
    }
  } catch {
    // a browser without audio support simply stays silent
  }
  menuMusic.state = 1;
  menuMusic.pendingPlay = true;
};

export const pauseMenuMusic = () => {
  if (menuMusic.state == 1) {
    if (unlocked) {
      menuMusic.track.pause();
    }
    menuMusic.state = 2;
  }
};

export const playStageMusic = (stage) => {
  try {
    if (stageMusic.stage != stage) {
      stageMusic.track = new Audio(`data/music/stage${stage}.mp3`);
      stageMusic.track.volume = 1;
      stageMusic.track.loop = true;
      stageMusic.stage = stage;
    } else {
      stageMusic.track.currentTime = 0;
    }
    stageMusic.track.volume = 0.7;
    if (unlocked && !audio.muteMusic && !isIos) {
      stageMusic.track.play();
    }
  } catch {
    // a browser without audio support simply stays silent
  }
  stageMusic.state = 1;
  stageMusic.pendingPlay = true;
};

export const stopStageMusic = () => {
  if (stageMusic.state == 1) {
    if (unlocked) {
      stageMusic.track.pause();
    }
    stageMusic.state = 2;
  }
};

export const resumeStageMusic = () => {
  if (stageMusic.state == 2) {
    if (unlocked && !audio.muteMusic) {
      stageMusic.track.play();
    }
    stageMusic.state = 1;
  }
};

// Mute and unmute whatever music is playing, without changing what is playing.
export const pauseMusic = () => {
  for (const music of [stageMusic, menuMusic]) {
    if (music.state == 1 && unlocked) {
      music.track.pause();
    }
  }
};

export const resumeMusic = () => {
  for (const music of [stageMusic, menuMusic]) {
    if (music.state == 1 && unlocked) {
      music.track.play();
    }
  }
};

const createContexts = () => {
  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    const sounds = new AudioContext();
    const engines = new AudioContext();
    engine.volume = engines.createGain();
    return { sounds, engines };
  } catch {
    return null;
  }
};

const contexts = createContexts();
const soundBuffers = [];
const soundLoaded = [];
const engineBuffers = [];
const engineLoaded = Array.from({ length: 19 }, () => false);
let playedASound = false;
let firstSoundRetries = 5;

// Like the original, a sound counts as loaded once its file arrived, before it is decoded.
const loadBuffer = (context, file, onArrived, onDecoded) => {
  const request = new XMLHttpRequest();
  request.open("GET", file, true);
  request.responseType = "arraybuffer";
  request.onload = () => {
    context.decodeAudioData(request.response, onDecoded, () => {});
    onArrived();
  };
  request.send();
};

export const loadSound = (sound) => {
  if (contexts) {
    soundLoaded[sound] = false;
    loadBuffer(
      contexts.sounds,
      `data/sounds/s${sound}.mp3`,
      () => {
        soundLoaded[sound] = true;
      },
      (buffer) => {
        soundBuffers[sound] = buffer;
      },
    );
  }
};

export const playSound = (sound, rate) => {
  if (contexts && soundLoaded[sound] && !audio.muteSound) {
    const source = contexts.sounds.createBufferSource();
    source.buffer = soundBuffers[sound];
    source.connect(contexts.sounds.destination);
    source.playbackRate.value = rate;
    source.start();
    playedASound = true;
  }
};

export const loadEngine = (carType) => {
  if (contexts) {
    loadBuffer(
      contexts.engines,
      `data/sounds/eng${carType}.wav`,
      () => {
        engineLoaded[carType] = true;
      },
      (buffer) => {
        engineBuffers[carType] = buffer;
      },
    );
  }
};

export const isEngineLoaded = (carType) => engineLoaded[carType];

export const startEngine = (carType, loop) => {
  if (contexts && engineLoaded[carType] && !audio.muteSound) {
    engine.source = contexts.engines.createBufferSource();
    engine.source.buffer = engineBuffers[carType];
    engine.source.connect(engine.volume);
    engine.volume.connect(contexts.engines.destination);
    engine.source.loop = loop;
    engine.source.start();
    engine.started = true;
  }
};

export const stopEngine = () => {
  if (engine.started) {
    engine.source.loop = false;
    engine.started = false;
  }
};

// Called on every click and touch: the first one allows audio, then starts music that
// could not start before. In a race (iOS), sound 25 is replayed until the audio clock runs.
export const unlockAudio = (inRace) => {
  unlocked = true;
  if (menuMusic.pendingPlay && menuMusic.state == 1 && !audio.muteMusic) {
    if (menuMusic.track.currentTime == 0) {
      menuMusic.track.play();
      menuMusic.firstPlay = false;
    }
    menuMusic.pendingPlay = false;
  }
  if (stageMusic.pendingPlay && stageMusic.state == 1 && !audio.muteMusic) {
    if (stageMusic.track.currentTime == 0) {
      stageMusic.track.play();
    }
    stageMusic.pendingPlay = false;
  }
  if (
    firstSoundRetries &&
    playedASound &&
    inRace &&
    contexts &&
    soundLoaded[25] &&
    !audio.muteSound
  ) {
    if (contexts.sounds.currentTime == 0) {
      playSound(25, 1);
      firstSoundRetries = 1;
    }
    firstSoundRetries--;
  }
};
