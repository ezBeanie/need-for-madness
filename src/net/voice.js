// The room's voice chat: every two games of a room talk directly (WebRTC), set up through
// the relay's messages; the relay only tells them how to find each other (ICE_PATH: the
// STUN and TURN servers, see server/ice.js). A player is heard only while holding the talk
// key (push to talk: the microphone is asked for at the first press). In a race each voice
// comes from its car, quieter the farther away; in the lobby all are heard alike.

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
// how loud a voice must be to show its player talking
const TALKING = 0.02;

// on: the voice chat at all (an option); talking: the talk key held; microphone: whether
// the player allowed it (null: not asked yet); peers: by game id
export const voice = {
  on: loadSetting("voiceChat") != 0,
  talking: false,
  microphone: null,
  peers: new Map(),
};

let iceServers = null;
let context = null;
let out = null;
let track = null;
let asking = null;

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
  peer.level.fftSize = 256;
  peer.source.connect(peer.level);
  peer.source.connect(peer.gain).connect(peer.panner);
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
  const peer = { connection, heardTicks: 0 };
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
    await connection.setLocalDescription(await connection.createOffer());
    signal(id, { description: connection.localDescription.toJSON() });
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
  const peer = voice.peers.get(message.from) ?? (await connect(message.from));
  if (!peer) {
    return;
  }
  peer.heardTicks = 0;
  const { connection } = peer;
  try {
    if (isDescription(message.description)) {
      await connection.setRemoteDescription(message.description);
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
    if (message.candidate && typeof message.candidate == "object") {
      await connection.addIceCandidate(message.candidate);
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
      [track] = stream.getAudioTracks();
      track.enabled = voice.talking;
      voice.microphone = true;
      for (const peer of voice.peers.values()) {
        peer.sender?.replaceTrack(track);
      }
    })
    .catch(() => {
      voice.microphone = false;
    }));

export const toggleVoice = () => {
  voice.on = !voice.on;
  saveSetting("voiceChat", voice.on ? 1 : 0);
  if (!voice.on) {
    talk(false);
  }
};

// The talk key, pressed or let go.
export const talk = (pressed) => {
  voice.talking = pressed && voice.on && link.role != ROLE.none;
  if (voice.talking && !track && navigator.mediaDevices) {
    openMicrophone();
  }
  if (track) {
    track.enabled = voice.talking;
  }
  context?.resume();
};

// whether the player of game id is heard talking now
export const isTalking = (id) => {
  const level = voice.peers.get(id)?.level;
  if (!level) {
    return false;
  }
  const samples = new Float32Array(level.fftSize);
  level.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length) > TALKING;
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
  const wanted =
    voice.on && link.role != ROLE.none && link.open
      ? new Set(others(playerIds))
      : new Set();
  for (const id of [...voice.peers.keys()]) {
    if (!wanted.has(id)) {
      closePeer(id);
    }
  }
  for (const id of wanted) {
    // (the smaller id offers; the other waits to be asked)
    if (!voice.peers.has(id) && link.id < id) {
      connect(id);
    }
  }
  placeVoices();
};
