// Coach Insano, who explains the game, gives tips before stages and comments on races.

import { random } from "../core/random.js";
import { images } from "./images.js";
import { rd, view } from "./view.js";
import { blink } from "./widgets.js";

export const insano = {
  // which of his six pictures shows
  picture: 0,
  // ticks he keeps talking (his picture flickers while it runs)
  talkTicks: 0,
};

// the picture of him listening
const QUIET = 2;

export const pickTalkingPicture = () => {
  insano.picture = Math.floor(random.fx() * 6);
  if (insano.picture == 6) {
    insano.picture = 5;
  }
};

// The scale of Insano and his speech bubble: the width's, but no more than 1.2 times the
// height's on wide screens.
export const insanoScale = () => {
  let scale = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    scale *= 1.2 / (view.scaleX / view.scaleY);
  }
  return scale;
};

// Every second frame, while talkTicks last, he shows another picture.
export const talkWhileTicksLast = () => {
  blink.on = !blink.on;
  if (insano.talkTicks > 0) {
    if (blink.on) {
      pickTalkingPicture();
    }
    insano.talkTicks--;
  } else {
    insano.picture = QUIET;
  }
};

// Insano at the left edge, at the given height.
export const drawInsano = (scale, top) => {
  rd.drawImage(
    images.insano[insano.picture],
    10 * scale,
    top,
    274 * scale * 0.7,
    341 * scale * 0.7,
  );
};

// A rounded box whose left edge has a tail pointing down to Insano.
export const fillSpeechBubble = (x, y, width, height, cornerRadius) => {
  rd.beginPath();
  rd.moveTo(x + cornerRadius, y);
  rd.lineTo(x + width - cornerRadius, y);
  rd.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  rd.lineTo(x + width, y + height - cornerRadius);
  rd.quadraticCurveTo(
    x + width,
    y + height,
    x + width - cornerRadius,
    y + height,
  );
  rd.lineTo(x + cornerRadius, y + height);
  rd.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  const scale = insanoScale();
  rd.lineTo(x, 260 * view.scaleY + 200 * scale);
  rd.lineTo(150 * scale, 260 * view.scaleY + 200 * scale);
  rd.lineTo(x, 260 * view.scaleY + 230 * scale);
  rd.lineTo(x, y + cornerRadius);
  rd.quadraticCurveTo(x, y, x + cornerRadius, y);
  rd.fill();
};
