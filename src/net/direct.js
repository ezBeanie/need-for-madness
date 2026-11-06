// The direct links between a room's games in the same network (a WLAN, a phone's hotspot):
// set up over the relay, then every message goes both ways and the quicker one counts (see
// hear in link.js). Each guest links with the host, and the host passes on what it hears to
// the guests linked with it, as the relay does. With no STUN server only the addresses in
// the own network are tried: games in other networks stay with the relay, and no game
// learns another's address on the internet.

import {
  MESSAGE,
  MOST_PLAYERS,
  ROLE,
  isPlayerId,
  link,
  linkChanged,
} from "./link.js";

// a link not open by then is tried anew (at the host's next players)
const RETRY_MS = 10_000;
// what one game sends directly in a second at most, as the relay takes it
const MOST_PER_SECOND = 120;
// a game this far behind in receiving misses messages, as with the relay
const MOST_BUFFERED_BYTES = 1024 * 1024;

// id -> { connection, channel, since, early }: the other game's link, the candidates that
// came before its description
export const direct = { peers: new Map() };

let hearDirectly = () => {};

export const linkedDirectly = (id) =>
  direct.peers.get(id)?.channel?.readyState == "open";

export const directLinks = () => {
  let open = 0;
  for (const id of direct.peers.keys()) {
    open += linkedDirectly(id) ? 1 : 0;
  }
  return open;
};

const signal = (to, data) => link.send({ type: MESSAGE.direct, to, ...data });

const closePeer = (id) => {
  const peer = direct.peers.get(id);
  if (!peer) {
    return;
  }
  direct.peers.delete(id);
  peer.connection.close();
  linkChanged();
};

// What comes over a channel goes on as if from the relay, as much as the relay would take.
const listen = (id, channel) => {
  const peer = direct.peers.get(id);
  peer.channel = channel;
  let second = 0;
  let heardThisSecond = 0;
  channel.onopen = linkChanged;
  channel.onclose = () => direct.peers.get(id) == peer && closePeer(id);
  channel.onmessage = ({ data }) => {
    const now = performance.now();
    if (now - second >= 1000) {
      second = now;
      heardThisSecond = 0;
    }
    if (typeof data == "string" && ++heardThisSecond <= MOST_PER_SECOND) {
      hearDirectly(data, id);
    }
  };
};

const newPeer = (id) => {
  const connection = new RTCPeerConnection({ iceServers: [] });
  const peer = {
    connection,
    channel: null,
    since: performance.now(),
    early: [],
  };
  direct.peers.set(id, peer);
  connection.onicecandidate = ({ candidate }) =>
    candidate && signal(id, { candidate: candidate.toJSON() });
  connection.onconnectionstatechange = () => {
    if (connection.connectionState == "failed") {
      closePeer(id);
    }
  };
  return peer;
};

// A guest links with the host (again, when the last try has not worked by now).
export const linkDirectly = async (id) => {
  if (
    link.role != ROLE.guest ||
    !globalThis.RTCPeerConnection ||
    !isPlayerId(id)
  ) {
    return;
  }
  const old = direct.peers.get(id);
  if (old && (linkedDirectly(id) || performance.now() - old.since < RETRY_MS)) {
    return;
  }
  closePeer(id);
  const { connection } = newPeer(id);
  listen(id, connection.createDataChannel("room"));
  try {
    await connection.setLocalDescription(await connection.createOffer());
    signal(id, { description: connection.localDescription.toJSON() });
  } catch {
    // (closed meanwhile: the game left the room)
  }
};

const isDescription = (description) =>
  ["offer", "answer"].includes(description?.type) &&
  typeof description.sdp == "string";

// A message setting up a direct link with this game: the host takes offers from guests
// (as many as the room has room for), a guest the host's answer.
export const receiveDirect = async (message) => {
  if (
    message.type != MESSAGE.direct ||
    message.to != link.id ||
    !globalThis.RTCPeerConnection
  ) {
    return;
  }
  const { from, description, candidate } = message;
  const offered = description?.type == "offer";
  if (offered && link.role == ROLE.host && isDescription(description)) {
    if (!direct.peers.has(from) && direct.peers.size >= MOST_PLAYERS - 1) {
      return;
    }
    // (a guest offering anew set its own link up anew)
    closePeer(from);
    const { connection } = newPeer(from);
    connection.ondatachannel = ({ channel }) => listen(from, channel);
  }
  const peer = direct.peers.get(from);
  if (!peer || (offered && link.role != ROLE.host)) {
    return;
  }
  const { connection } = peer;
  try {
    if (candidate && typeof candidate == "object") {
      if (connection.remoteDescription) {
        await connection.addIceCandidate(candidate);
      } else {
        peer.early.push(candidate);
      }
    }
    if (isDescription(description)) {
      await connection.setRemoteDescription(description);
      for (const early of peer.early.splice(0)) {
        await connection.addIceCandidate(early);
      }
      if (offered) {
        await connection.setLocalDescription(await connection.createAnswer());
        signal(from, { description: connection.localDescription.toJSON() });
      }
    }
  } catch {
    // (a broken message from another game: the relay goes on for it)
  }
};

// Sends a message (as the link encoded it) to every game linked directly but one.
export const sendDirectly = (text, but = null) => {
  for (const [id, { channel }] of direct.peers) {
    if (
      id != but &&
      channel?.readyState == "open" &&
      channel.bufferedAmount < MOST_BUFFERED_BYTES
    ) {
      try {
        channel.send(text);
      } catch {
        // (bigger than the channel takes: the relay carries it)
      }
    }
  }
};

// The link's way to take what comes directly (see openLink).
export const openDirect = (hear) => {
  hearDirectly = hear;
};

export const closeDirect = () => {
  for (const id of [...direct.peers.keys()]) {
    closePeer(id);
  }
  hearDirectly = () => {};
};
