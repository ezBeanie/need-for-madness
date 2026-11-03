// The room's voice chat, off until the player switches it on (the games of a room then learn
// each other's internet address): every two games of a room talk directly (WebRTC), set up
// through the relay's messages; the relay only tells them how to find each other
// (ICE_PATH: the STUN and TURN servers, see server/ice.js). A player is heard only while
// talking: holding the talk key (push to talk, the microphone asked for at the first press),
// or, by voice, while the microphone hears the player (asked for on entering the room). In a
// race each voice comes from its car, quieter the farther away; in the lobby all alike.

import { audio, placeSound, placedIn } from "../audio/audio.js";
import { loadSetting, saveSetting } from "../core/storage.js";
import { RACE_PHASES, game } from "../core/state.js";
import { car } from "../race/racers.js";
import { heardFrom } from "../render/camera.js";
import { MESSAGE, ROLE, isPlayerId, link } from "./link.js";
import { lockstep } from "./lockstep.js";

const ICE_PATH = "/net/ice";
// how far another car's voice is heard: fully up to NEAR, fading out at FAR
const NEAR = 300;
const FAR = 4000;
// how loud a voice must be to show its player talking, and for how long after (ms)
const TALKING = 0.02;
const TALKING_AFTER_MS = 600;
// by voice: how loud the own microphone must be to send, and for how long after (ms), so
// that the ends of words and short pauses go too
const SPEAKING = 0.03;
const SPEAKING_AFTER_MS = 500;
// a voice not connected after this many ticks (the other game ignored the offer, its voice
// off then) is set up anew
const RETRY_TICKS = 150;

// on: the voice chat at all (an option); byVoice: talking when the microphone hears the
// player instead of with the talk key (an option); talking: the player heard now;
// microphone: whether the player allowed it (null: not asked yet); peers: by game id
export const voice = {
  on: loadSetting("voiceChat") == 1,
  byVoice: loadSetting("voiceByVoice") == 1,
  talking: false,
  microphone: null,
  peers: new Map(),
};

let iceServers = null;
let context = null;
let out = null;
let track = null;
let asking = null;
// the own microphone's loudness, measured on a copy of it (a track switched off hears
// nothing), and when it was last loud (by voice)
const own = { heard: null, level: null, samples: null, loudAt: -Infinity };

const askIceServers = () =>
  (iceServers ??= fetch(ICE_PATH)
    .then((response) => (response.ok ? response.json() : { iceServers: [] }))
    .then((config) => config.iceServers ?? [])
    .catch(() => []));

const audioContext = () => {
  if (!context) {
    // (older Safaris know only webkitAudioContext)
    context = new (window.AudioContext || window.webkitAudioContext)();
    out = context.createGain();
    out.connect(context.destination);
  }
  return context;
};

// A voice arrived: played through a panner, from where its car is (see placeVoices).
const hear = (peer, stream) => {
  // (Chrome hands a remote stream's sound to Web Audio only while an element plays it)
  peer.element = new Audio();
  peer.element.muted = true;
  peer.element.srcObject = stream;
  const ctx = audioContext();
  peer.source = ctx.createMediaStreamSource(stream);
  peer.gain = ctx.createGain();
  peer.panner = placedIn(ctx, out);
  peer.level = ctx.createAnalyser();
  peer.level.fftSize = 2048;
  peer.samples = new Float32Array(peer.level.fftSize);
  peer.source.connect(peer.level);
  peer.source.connect(peer.gain).connect(peer.panner);
  // (a context made outside a click starts suspended in Safari: see the listeners below)
  ctx.resume().catch(() => {});
  peer.element.play().catch(() => {});
};

const signal = (to, data) => link.send({ type: MESSAGE.voice, to, ...data });

const closePeer = (id) => {
  const peer = voice.peers.get(id);
  if (!peer) {
    return;
  }
  peer.connection.close();
  peer.source?.disconnect();
  peer.panner?.disconnect();
  if (peer.element) {
    peer.element.srcObject = null;
  }
  voice.peers.delete(id);
};

// What a voice sends on: the microphone, once there.
const send = (peer, transceiver) => {
  peer.sender = transceiver.sender;
  if (track) {
    peer.sender.replaceTrack(track);
  }
};

// (the game with the smaller id offers, so two never offer to each other at once)
const connect = async (id) => {
  const servers = await askIceServers();
  if (voice.peers.has(id) || !voice.on || link.role == ROLE.none) {
    return voice.peers.get(id);
  }
  const connection = new RTCPeerConnection({ iceServers: servers });
  // ticks since set up; the candidates that came before the other's description
  const peer = { connection, ticks: 0, early: [] };
  voice.peers.set(id, peer);
  // (the offer sends from the start, silent until the microphone comes: no new offer
  // then; the answer sends on what the offer brought, see receiveVoice)
  if (link.id < id) {
    send(peer, connection.addTransceiver("audio", { direction: "sendrecv" }));
  }
  connection.onicecandidate = ({ candidate }) =>
    candidate && signal(id, { candidate: candidate.toJSON() });
  connection.ontrack = ({ streams, track: remote }) =>
    hear(peer, streams[0] ?? new MediaStream([remote]));
  connection.onconnectionstatechange = () => {
    if (connection.connectionState == "failed") {
      closePeer(id);
    }
  };
  if (peer.sender) {
    try {
      await connection.setLocalDescription(await connection.createOffer());
      signal(id, { description: connection.localDescription.toJSON() });
    } catch {
      // (closed meanwhile: the game left the room, or the other did)
    }
  }
  return peer;
};

const isDescription = (description) =>
  ["offer", "answer"].includes(description?.type) &&
  typeof description.sdp == "string";

// A message of another game's voice for this one.
export const receiveVoice = async (message) => {
  if (
    message.type != MESSAGE.voice ||
    message.to != link.id ||
    !isPlayerId(message.from) ||
    !voice.on
  ) {
    return;
  }
  // (an offer to a voice set up before: the other game set its own up anew)
  if (
    message.description?.type == "offer" &&
    voice.peers.get(message.from)?.connection.remoteDescription
  ) {
    closePeer(message.from);
  }
  const peer = voice.peers.get(message.from) ?? (await connect(message.from));
  if (!peer) {
    return;
  }
  const { connection } = peer;
  try {
    if (message.candidate && typeof message.candidate == "object") {
      if (connection.remoteDescription) {
        await connection.addIceCandidate(message.candidate);
      } else {
        peer.early.push(message.candidate);
      }
    }
    if (isDescription(message.description)) {
      await connection.setRemoteDescription(message.description);
      for (const candidate of peer.early.splice(0)) {
        await connection.addIceCandidate(candidate);
      }
      if (message.description.type == "offer") {
        const [transceiver] = connection.getTransceivers();
        transceiver.direction = "sendrecv";
        send(peer, transceiver);
        await connection.setLocalDescription(await connection.createAnswer());
        signal(message.from, {
          description: connection.localDescription.toJSON(),
        });
      }
    }
  } catch {
    // (a broken message from another game: its voice stays away)
  }
};

// The ids of the other games in the room: the players the lobby lists, racing the race's.
const others = (playerIds) => playerIds.filter((id) => id != link.id);

// Asks for the microphone (once), and sends it to every voice.
const openMicrophone = () =>
  (asking ??= navigator.mediaDevices
    .getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    .then((stream) => {
      // (let go of the key, or switched off, while the browser asked)
      if (!voice.on || link.role == ROLE.none) {
        stream.getTracks().forEach((given) => given.stop());
        asking = null;
        return;
      }
      [track] = stream.getAudioTracks();
      track.enabled = voice.talking;
      voice.microphone = true;
      // (only measured, never played)
      own.heard = track.clone();
      own.heard.enabled = true;
      own.level = audioContext().createAnalyser();
      own.level.fftSize = 2048;
      own.samples = new Float32Array(own.level.fftSize);
      audioContext()
        .createMediaStreamSource(new MediaStream([own.heard]))
        .connect(own.level);
      for (const peer of voice.peers.values()) {
        peer.sender?.replaceTrack(track);
      }
    })
    .catch(() => {
      voice.microphone = false;
    }));

// The microphone given back (the browser stops showing it in use), once the voice chat is
// off or the room left; the next talk asks for it again.
const closeMicrophone = () => {
  track?.stop();
  track = null;
  asking = null;
  own.heard?.stop();
  own.heard = null;
  own.level = null;
  for (const peer of voice.peers.values()) {
    peer.sender?.replaceTrack(null);
  }
};

export const toggleVoice = () => {
  voice.on = !voice.on;
  saveSetting("voiceChat", voice.on ? 1 : 0);
  if (!voice.on) {
    talk(false);
    closeMicrophone();
  }
};

export const toggleByVoice = () => {
  voice.byVoice = !voice.byVoice;
  saveSetting("voiceByVoice", voice.byVoice ? 1 : 0);
  talk(false);
};

// The talk key, pressed or let go (by voice it does nothing). (A key let go in another
// window, or in a dialog the game leaves keys to, never comes: leaving the page lets go of
// it too.)
export const talk = (pressed) => {
  if (voice.byVoice && pressed) {
    return;
  }
  voice.talking = pressed && voice.on && link.role != ROLE.none;
  if (voice.talking && !track && navigator.mediaDevices) {
    openMicrophone();
  }
  if (track) {
    track.enabled = voice.talking;
  }
  context?.resume().catch(() => {});
};

globalThis.addEventListener?.("blur", () => talk(false));
globalThis.document?.addEventListener?.("visibilitychange", () => talk(false));
globalThis.addEventListener?.("keyup", (event) => {
  if (event.code == "KeyP") {
    talk(false);
  }
});
// (Safari lets a context play only after a click or a key)
globalThis.addEventListener?.("pointerdown", () =>
  context?.resume().catch(() => {}),
);

// whether the player of game id is heard talking now
export const isTalking = (id) => {
  const loudAt = voice.peers.get(id)?.loudAt;
  return loudAt !== undefined && performance.now() - loudAt < TALKING_AFTER_MS;
};

// how loud what an analyser hears now is (its root mean square)
const loudness = (level, samples) => {
  level.getFloatTimeDomainData(samples);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
};

// Every tick: when each voice was last loud.
const listen = () => {
  for (const peer of voice.peers.values()) {
    if (peer.level && loudness(peer.level, peer.samples) > TALKING) {
      peer.loudAt = performance.now();
    }
  }
};

// By voice, every tick: the microphone (asked for once in the room) sends while it hears
// the player, and a little after.
const talkByVoice = (inRoom) => {
  if (!voice.byVoice || !inRoom) {
    return;
  }
  if (!track && voice.microphone !== false && navigator.mediaDevices) {
    openMicrophone();
  }
  if (!own.level) {
    return;
  }
  const now = performance.now();
  if (loudness(own.level, own.samples) > SPEAKING) {
    own.loudAt = now;
  }
  voice.talking = now - own.loudAt < SPEAKING_AFTER_MS;
  track.enabled = voice.talking;
};

// Each voice from its car in a race, quieter the farther; in the lobby all alike.
const placeVoices = () => {
  const racing = RACE_PHASES.includes(game.phase) && lockstep.active;
  for (const [id, peer] of voice.peers) {
    if (!peer.gain) {
      continue;
    }
    const c = racing ? lockstep.players.indexOf(id) : -1;
    let volume = audio.muteSound ? 0 : audio.soundVolume;
    let place = { side: 0, front: 1 };
    if (c >= 0) {
      place = heardFrom(car[c].x, car[c].z);
      volume *= Math.max(0, Math.min(1, (FAR - place.distance) / (FAR - NEAR)));
    }
    peer.gain.gain.value = volume;
    placeSound(peer.panner, place.side, place.front);
  }
};

// Every tick: a voice for every other game in the room, none for those gone or when off.
export const voiceTick = (playerIds) => {
  const inRoom = voice.on && link.role != ROLE.none;
  const wanted = inRoom && link.open ? new Set(others(playerIds)) : new Set();
  for (const [id, peer] of [...voice.peers]) {
    peer.ticks++;
    const stuck =
      peer.ticks > RETRY_TICKS &&
      peer.connection.connectionState != "connected";
    if (!wanted.has(id) || stuck) {
      closePeer(id);
    }
  }
  if (!inRoom && track) {
    talk(false);
    closeMicrophone();
  }
  for (const id of wanted) {
    // (the smaller id offers; the other waits to be asked)
    if (!voice.peers.has(id) && link.id < id) {
      connect(id);
    }
  }
  talkByVoice(inRoom);
  placeVoices();
  listen();
};
