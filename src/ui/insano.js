// Coach Insano, who explains the game, gives tips before stages and comments on races.

import { isPhone } from "../core/platform.js";
import { random } from "../core/random.js";
import { raceEvents } from "../race/events.js";
import { track } from "../race/track.js";
import { cssRgb } from "./color.js";
import { hud } from "./hud.js";
import { images } from "./images.js";
import { rd, view } from "./view.js";
import { BUTTON, blink, drawButton, drawMeter } from "./widgets.js";

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

// Insano talking, with the big speech bubble of the instructions and the reset question.
// Returns the bubble's top.
export const drawTalkingInsano = (scale) => {
  talkWhileTicksLast();
  drawInsano(scale, 260 * view.scaleY);
  const top = 260 * view.scaleY - 200 * scale;
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.7;
  fillSpeechBubble(200 * scale, top, 1060 * scale, 570 * scale, 20 * scale);
  rd.globalAlpha = 1;
  return top;
};

export const BUBBLE_INK = "#002748";

export const startBubbleText = (scale) => {
  rd.letterSpacing = "0px";
  rd.font = "" + 30 * scale + "px verd";
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillStyle = BUBBLE_INK;
};

// Lines of text in the bubble, each at its height below the bubble's top.
export const writeBubbleLines = (scale, top, lines) => {
  lines.forEach(([y, text]) => {
    rd.fillText(text, 200 * scale + 20 * scale, top + y * scale);
  });
};

// "A stunt = power": the picture of a stunt and a power meter at 70 of 98, the meter
// meterOffset and the picture pictureOffset below top.
export const drawStuntMeansPower = (scale, top, meterOffset, pictureOffset) => {
  const meterTop = top + meterOffset * scale;
  rd.font = "" + 50 * scale + "px verd";
  rd.fillText("=", 770 * scale, meterTop + 55 * view.scale);
  rd.drawImage(
    images.instructions[4],
    200 * scale + 90 * scale,
    top + pictureOffset * scale,
    464 * scale,
    150 * scale,
  );
  rd.letterSpacing = "1px";
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "right";
  rd.fillStyle = "#000000";
  rd.fillText(
    "Power",
    945 * scale - 15 * view.scale,
    meterTop + 55 * view.scale,
  );
  drawMeter(
    945 * scale,
    meterTop + 42 * view.scale,
    "#00B0DC",
    "#005C96",
    cssRgb([128, 190 + 70 * 0.37, 255]),
    70 / 98,
  );
};

// While a stage the player has just unlocked starts, Insano says how to win it: stage 2
// with stunts, stage 4 by wasting the others with the help of the arrow.
export const drawStartHint = () => {
  const scale = insanoScale();
  const top = 260 * view.scaleY;
  hud.powerBlink = !hud.powerBlink;
  if (raceEvents.countdown > 130) {
    if (hud.powerBlink) {
      pickTalkingPicture();
    }
  } else {
    insano.picture = QUIET;
  }
  drawInsano(scale, top);
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.7;
  const height = track.stage == 4 ? 280 : 250;
  fillSpeechBubble(200 * scale, top, 1060 * scale, height * scale, 20 * scale);
  rd.globalAlpha = 1;
  startBubbleText(scale);
  if (track.stage == 2) {
    writeBubbleLines(scale, top, [
      [36, "Preform stunts to power up your car!"],
    ]);
    drawStuntMeansPower(scale, top, 80, 70);
  }
  if (track.stage == 4) {
    writeBubbleLines(scale, top, [
      [36, "It is easier to just waste the other cars in this stage!"],
      [96, "Use the Arrow Target button"],
    ]);
    drawArrowButton(scale, top);
    rd.drawImage(
      images.instructions[8],
      200 * scale + 530 * scale,
      top + 80 * scale,
      382 * scale,
      164 * scale,
    );
  }
};

// the key that toggles the arrow, or on phones its touch button
const drawArrowButton = (scale, top) => {
  if (isPhone) {
    rd.drawImage(
      images.touchControls[5],
      200 * scale + 165 * scale,
      top + 130 * scale,
      154 * view.scale,
      111 * view.scale,
    );
    return;
  }
  drawButton({
    id: 1,
    x: 200 * scale + 240 * scale,
    y: top + 130 * scale,
    width: 100,
    height: 60,
    faceTop: "#89C800",
    faceBottom: "#CADC00",
    shadowTop: "#4B6E00",
    shadowBottom: "#778200",
    layout: BUTTON.textThenImage,
    text: "A",
    fontSize: 22,
    textOpacity: 0.76,
    image: images.buttons[0],
    imageOpacity: 1,
    pulsing: false,
  });
};
