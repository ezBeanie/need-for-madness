// Music (one menu track, one track per stage), sound effects and the looping engine sound.
// Browsers only play audio after the player touched the page: see unlockAudio.

import { musicOf } from "../data/stages.js";
import { loadSetting, saveSetting } from "../core/storage.js";
import { CLASSIC_FILES, CLASSIC_SOUNDS } from "../classic/sounds.js";
import { isIos } from "../core/platform.js";
import { LOOK, look } from "../render/look.js";
import { fetchText } from "../render/models.js";

// A volume kept in percent, 100 if none is.
const storedVolume = (name) => {
  const percent = loadSetting(name);
  return percent < 0 ? 1 : Math.min(percent, 100) / 100;
};

// otherCars: the other cars' crashes, scrapes and skids are heard too (see carSounds.js);
// musicVolume and soundVolume: 0..1, as the options' sliders set them
export const audio = {
  muteMusic: false,
  muteSound: false,
  otherCars: loadSetting("otherCarSounds") != 0,
  musicVolume: storedVolume("musicVolume"),
  soundVolume: storedVolume("soundVolume"),
};

export const toggleOtherCarSounds = () => {
  audio.otherCars = !audio.otherCars;
  saveSetting("otherCarSounds", audio.otherCars ? 1 : 0);
};

// The engine sound of the player's car; the game adjusts its pitch and volume while driving.
export const engine = { started: false, source: null, volume: null };

let unlocked = false;

// Music tracks: state 0 = never played, 1 = playing, 2 = paused.
// (file: the track's, which the look decides)
// (level: how loud the track plays at full music volume)
const menuMusic = {
  track: null,
  level: 0.6,
  file: null,
  state: 0,
  pendingPlay: false,
  firstPlay: true,
};
const stageMusic = {
  track: null,
  level: 0.7,
  file: "",
  state: 0,
  pendingPlay: false,
};

// (iOS leaves the modern look's tracks, audio elements, as loud as they are)
const turnUp = (music) => {
  if (music.track) {
    music.track.volume = music.level * audio.musicVolume;
  }
};

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
    musicLoops ??= new Promise((resolve) =>
      fetchText("data/classic/music/loops.json", (text) =>
        resolve(JSON.parse(text)),
      ),
    );
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

const newTrack = (file, classic = look.current == LOOK.classic) =>
  classic ? classicTrack(file) : new Audio(`data/music/${file}.mp3`);

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
    turnUp(menuMusic);
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

// the stage's own track, the same in both looks
export const playStageMusic = (stage) => {
  try {
    const music = musicOf(stage);
    if (stageMusic.file != music.file) {
      stageMusic.track?.pause();
      stageMusic.track = newTrack(music.file, music.classic);
      stageMusic.track.volume = 1;
      stageMusic.track.loop = true;
      stageMusic.file = music.file;
    } else {
      stageMusic.track.currentTime = 0;
    }
    turnUp(stageMusic);
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

// The look changed: the menus' music playing now is the new look's (a stage keeps its
// own).
export const switchMusicLook = () => {
  if (menuMusic.state == 1) {
    playMenuMusic();
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

export const setMusicVolume = (volume) => {
  audio.musicVolume = volume;
  saveSetting("musicVolume", Math.round(volume * 100));
  turnUp(menuMusic);
  turnUp(stageMusic);
};

export const setSoundVolume = (volume) => {
  audio.soundVolume = volume;
  saveSetting("soundVolume", Math.round(volume * 100));
  if (contexts) {
    contexts.soundsOut.gain.value = volume;
    contexts.enginesOut.gain.value = volume;
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
    // what all sound effects and engines go through, for their volume
    const soundsOut = sounds.createGain();
    soundsOut.connect(sounds.destination);
    const enginesOut = engines.createGain();
    enginesOut.connect(engines.destination);
    soundsOut.gain.value = audio.soundVolume;
    enginesOut.gain.value = audio.soundVolume;
    return { sounds, engines, soundsOut, enginesOut };
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

// A sound's way through a panner to out, from the side (-1 left .. 1 right) and front
// (-1 behind .. 1 before) given; its loudness is the caller's. HRTF is heard before and
// behind too, but costs: the many short sounds of a pile-up take the plain panning.
export const placedIn = (context, out, model = "HRTF") => {
  const panner = context.createPanner();
  panner.panningModel = model;
  panner.distanceModel = "linear";
  panner.rolloffFactor = 0;
  panner.connect(out);
  return panner;
};

export const placeSound = (panner, side, front) => {
  // (the listener looks along -z; older Safaris know only setPosition)
  if (panner.positionX) {
    panner.positionX.value = side;
    panner.positionZ.value = -front;
  } else {
    panner.setPosition(side, 0, -front);
  }
};

// place: null, or { volume (0..1), side, front } for a sound heard from afar (see placeSound)
const playBuffer = (buffer, rate, place = null) => {
  const source = contexts.sounds.createBufferSource();
  source.buffer = buffer;
  if (place) {
    const volume = contexts.sounds.createGain();
    volume.gain.value = place.volume;
    const panner = placedIn(contexts.sounds, contexts.soundsOut, "equalpower");
    placeSound(panner, place.side, place.front);
    source.connect(volume).connect(panner);
  } else {
    source.connect(contexts.soundsOut);
  }
  source.playbackRate.value = rate;
  source.start();
  playedASound = true;
  return source;
};

// place: where it is heard from (see playBuffer), null for the player's own sounds
export const playSound = (sound, rate, place = null) => {
  // the classic look plays the original's sound, as it was
  const file = look.current == LOOK.classic && CLASSIC_SOUNDS[sound];
  if (file) {
    const buffer = classicBuffer(file);
    if (buffer && !audio.muteSound) {
      playBuffer(buffer, 1, place);
    }
    return;
  }
  if (contexts && soundLoaded[sound] && !audio.muteSound) {
    playBuffer(soundBuffers[sound], rate, place);
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
    engine.volume.connect(contexts.enginesOut);
    engine.source.loop = loop;
    engine.source.start();
    engine.started = true;
  }
};

// The other cars' engine sounds, by car type, loaded apart from the player's: when the
// player's engine starts decides which random numbers its revs take, and so the race's
// effects (see engineSound.js).
const placedEngineBuffers = [];

// Another car's engine, looping silent until turned up, heard from where it is (see
// otherEngines.js): its source, loudness and panner; null while its sound has not come.
export const startPlacedEngine = (carType) => {
  if (!contexts || audio.muteSound) {
    return null;
  }
  if (placedEngineBuffers[carType] === undefined) {
    placedEngineBuffers[carType] = null;
    loadBuffer(
      contexts.engines,
      `data/sounds/eng${carType}.wav`,
      () => {},
      (buffer) => {
        placedEngineBuffers[carType] = buffer;
      },
    );
  }
  if (!placedEngineBuffers[carType]) {
    return null;
  }
  const source = contexts.engines.createBufferSource();
  source.buffer = placedEngineBuffers[carType];
  source.loop = true;
  const volume = contexts.engines.createGain();
  volume.gain.value = 0;
  const panner = placedIn(contexts.engines, contexts.enginesOut);
  source.connect(volume).connect(panner);
  source.start();
  return { source, volume, panner };
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
