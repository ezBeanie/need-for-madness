// Music (one menu track, one track per stage), sound effects and the looping engine sound.
// Browsers only play audio after the player touched the page: see unlockAudio.

import { CLASSIC_FILES, CLASSIC_SOUNDS } from "../classic/sounds.js";
import { isIos } from "../core/platform.js";
import { LOOK, look } from "../render/look.js";

export const audio = { muteMusic: false, muteSound: false };

// The engine sound of the player's car; the game adjusts its pitch and volume while driving.
export const engine = { started: false, source: null, volume: null };

let unlocked = false;

// Music tracks: state 0 = never played, 1 = playing, 2 = paused.
// (file: the track's, which the look decides)
const menuMusic = {
  track: null,
  file: null,
  state: 0,
  pendingPlay: false,
  firstPlay: true,
};
const stageMusic = { track: null, file: null, state: 0, pendingPlay: false };

// The classic look plays the original's tracks (see tools/classic/music), which loop from
// a point of their own: on the sound context, not as audio elements.
let musicLoops = null;

const classicTrack = (file) => {
  const context = contexts?.sounds;
  const track = {
    buffer: null,
    loop: [0, 0],
    source: null,
    gain: context?.createGain(),
    // where it is while paused, and when the playing started from 0
    offset: 0,
    startedAt: 0,
    playing: false,
    wanted: false,
    set volume(volume) {
      if (track.gain) {
        track.gain.gain.value = volume;
      }
    },
    get currentTime() {
      return track.playing ? track.position() : track.offset;
    },
    set currentTime(time) {
      track.offset = time;
      if (track.playing) {
        track.stop();
        track.start();
      }
    },
    position() {
      const [from, to] = track.loop;
      let time = context.currentTime - track.startedAt;
      if (to > from && time > to) {
        time = from + ((time - from) % (to - from));
      }
      return time;
    },
    start() {
      context.resume();
      track.source = context.createBufferSource();
      track.source.buffer = track.buffer;
      track.source.loop = true;
      [track.source.loopStart, track.source.loopEnd] = track.loop;
      track.source.connect(track.gain);
      track.gain.connect(context.destination);
      track.source.start(0, track.offset);
      track.startedAt = context.currentTime - track.offset;
      track.playing = true;
    },
    stop() {
      track.source.stop();
      track.playing = false;
    },
    play() {
      track.wanted = true;
      if (track.buffer && !track.playing) {
        track.start();
      }
    },
    pause() {
      track.wanted = false;
      if (track.playing) {
        track.offset = track.position();
        track.stop();
      }
    },
  };
  if (context) {
    musicLoops ??= fetch("data/classic/music/loops.json").then((r) => r.json());
    loadBuffer(
      context,
      `data/classic/music/${file}.mp3`,
      () => {},
      (buffer) => {
        musicLoops.then((loops) => {
          track.loop = loops[file] ?? [0, buffer.duration];
          track.buffer = buffer;
          if (track.wanted) {
            track.start();
          }
        });
      },
    );
  }
  return track;
};

const newTrack = (file) =>
  look.current == LOOK.classic
    ? classicTrack(file)
    : new Audio(`data/music/${file}.mp3`);

// the menus' track in the look
const menuFile = () => (look.current == LOOK.classic ? "interface" : "shift");

export const playMenuMusic = () => {
  try {
    if (menuMusic.state == 0 || menuMusic.file != menuFile()) {
      menuMusic.track?.pause();
      menuMusic.file = menuFile();
      menuMusic.track = newTrack(menuMusic.file);
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

// the stage's track in the look
const stageFile = (stage) => `${look.current}:stage${stage}`;

export const playStageMusic = (stage) => {
  try {
    if (stageMusic.file != stageFile(stage)) {
      stageMusic.track?.pause();
      stageMusic.track = newTrack(`stage${stage}`);
      stageMusic.track.volume = 1;
      stageMusic.track.loop = true;
      stageMusic.file = stageFile(stage);
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
  // the look changed meanwhile: the stage's track in it, from its start
  const stage = stageMusic.file?.split(":stage")[1];
  if (stageMusic.state == 2 && stageMusic.file != stageFile(stage)) {
    playStageMusic(stage);
    return;
  }
  if (stageMusic.state == 2) {
    if (unlocked && !audio.muteMusic) {
      stageMusic.track.play();
    }
    stageMusic.state = 1;
  }
};

// The look changed: the music playing now is the new look's.
export const switchMusicLook = () => {
  if (menuMusic.state == 1) {
    playMenuMusic();
  }
  if (stageMusic.state == 1) {
    playStageMusic(stageMusic.file.split(":stage")[1]);
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

// the original's sounds, by file, once asked for (see classic/sounds.js)
const classicBuffers = new Map();
let classicSoundsLoading = false;

const classicBuffer = (file) => {
  if (!classicSoundsLoading && contexts) {
    classicSoundsLoading = true;
    for (const name of CLASSIC_FILES) {
      loadBuffer(
        contexts.sounds,
        `data/classic/sounds/${name}.wav`,
        () => {},
        (buffer) => classicBuffers.set(name, buffer),
      );
    }
  }
  return classicBuffers.get(file);
};

const playBuffer = (buffer, rate) => {
  const source = contexts.sounds.createBufferSource();
  source.buffer = buffer;
  source.connect(contexts.sounds.destination);
  source.playbackRate.value = rate;
  source.start();
  playedASound = true;
  return source;
};

export const playSound = (sound, rate) => {
  // the classic look plays the original's sound, as it was
  const file = look.current == LOOK.classic && CLASSIC_SOUNDS[sound];
  if (file) {
    const buffer = classicBuffer(file);
    if (buffer && !audio.muteSound) {
      playBuffer(buffer, 1);
    }
    return;
  }
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

// The classic look's looping sounds, by channel (its engine, the rushes of air): each plays
// one file at a time; null silences it.
const classicLoops = new Map();

export const loopClassicSound = (channel, file) => {
  const playing = classicLoops.get(channel);
  if (playing?.file == file) {
    return;
  }
  playing?.source.stop();
  classicLoops.delete(channel);
  const buffer = file && classicBuffer(file);
  if (buffer && !audio.muteSound) {
    const source = playBuffer(buffer, 1);
    source.loop = true;
    classicLoops.set(channel, { file, source });
  }
};

export const stopClassicLoops = () => {
  for (const channel of [...classicLoops.keys()]) {
    loopClassicSound(channel, null);
  }
};

export const stopEngine = () => {
  if (engine.started) {
    engine.source.loop = false;
    engine.started = false;
  }
  stopClassicLoops();
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
