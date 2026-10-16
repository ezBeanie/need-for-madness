// The building blocks of the 2D interface: buttons, touch areas, centered text, meters
// and shapes, drawn on the interface canvas in 1280x720 design units scaled to the view.

import { audio } from "../audio/audio.js";
import { interfaceResolution, isFirefox } from "../core/platform.js";
import { pointer } from "../input/pointer.js";
import { images } from "./images.js";
import { rd, view } from "./view.js";

export const buttons = {
  // per pointer (finger or mouse): the id of the button it pressed, 0 for none
  pressedBy: [0, 0, 0, 0],
  // the button a key presses (e.g. R the rewind button), 0 for none
  pressedByKey: 0,
  // the pulse of the highlighted button, animated by the screens
  pulseWidth: 2,
  pulseHeight: 1,
  pulseWidthGrowing: false,
  pulseHeightGrowing: false,
};

// Flips every few ticks; the screens blink texts and buttons with it.
export const blink = { on: false };

// Is a finger or the mouse holding any button?
export const anyButtonHeld = () => {
  for (let i = 0; i < Math.max(pointer.count, 1); i++) {
    if (buttons.pressedBy[i] != 0) {
      return true;
    }
  }
  return false;
};

// What fits next to each other on a button.
export const BUTTON = {
  textThenImage: 0,
  textOnly: 1,
  imageOnly: 2,
  imageThenText: 3,
};

// Draws a button centered on x with its top at y (width and height in design units) and
// returns whether it was clicked: pressed and released on it. The face has a gradient of
// faceTop to faceBottom over a shadow (shadowTop to shadowBottom) that it covers while
// pressed. A pulsing button's gradient follows buttons.pulseWidth/pulseHeight.
export const drawButton = ({
  id,
  x,
  y,
  width,
  height,
  faceTop,
  faceBottom,
  shadowTop,
  shadowBottom,
  layout,
  text,
  fontSize,
  textOpacity,
  image,
  imageOpacity,
  pulsing,
}) => {
  width = width * view.scale;
  height = height * view.scale;
  let faceX = x - width * 0.5 + 5 * view.scale;
  let faceY = y + 4 * view.scale;
  let clicked = false;
  let pressed = false;
  for (let i = 0; i < Math.max(pointer.count, 1); i++) {
    if (
      pointer.x[i] > faceX - height * 0.3 &&
      pointer.x[i] < faceX + width + height * 0.3 &&
      pointer.y[i] > faceY &&
      pointer.y[i] < faceY + height
    ) {
      if (pointer.down) {
        buttons.pressedBy[i] = id;
        pressed = true;
      } else if (buttons.pressedBy[i] == id) {
        clicked = true;
        buttons.pressedBy[i] = 0;
      }
    } else if (buttons.pressedBy[i] == id) {
      buttons.pressedBy[i] = 0;
    }
  }
  if (buttons.pressedByKey == id) {
    pressed = true;
  }
  const pulseWidth = pulsing ? buttons.pulseWidth : 2;
  const pulseHeight = pulsing ? buttons.pulseHeight : 0.5;
  const face = (top, bottom) => {
    const gradient = rd.createLinearGradient(
      faceX,
      faceY - height * 0.5,
      faceX + width * 0.5 * pulseWidth,
      faceY - height * 0.5 + height * pulseHeight,
    );
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    rd.fillStyle = gradient;
    rd.beginPath();
    rd.moveTo(faceX, faceY);
    rd.lineTo(faceX - height * 0.3, faceY + height * 0.3334);
    rd.lineTo(faceX - height * 0.05, faceY + height * 0.9);
    rd.lineTo(faceX + height * 0.1, faceY + height);
    rd.lineTo(faceX + width, faceY + height);
    rd.lineTo(faceX + width + height * 0.3, faceY + height * 0.6667);
    rd.lineTo(faceX + width + height * 0.05, faceY + height * 0.1);
    rd.lineTo(faceX + width - height * 0.1, faceY);
    rd.closePath();
    rd.fill();
  };
  if (!pressed) {
    face(shadowTop, shadowBottom);
    faceX = x - width * 0.5;
    faceY = y;
  }
  face(faceTop, faceBottom);

  const imageWidth = () => image.width * view.scale * interfaceResolution;
  const imageHeight = () => image.height * view.scale * interfaceResolution;
  const imageTop = () =>
    faceY +
    height * 0.5 -
    image.height * view.scale * 0.5 * interfaceResolution;
  let contentWidth = 0;
  if (layout == BUTTON.textThenImage || layout == BUTTON.imageThenText) {
    rd.font = "" + fontSize * (view.scaleY + view.scaleX) + "px junk";
    rd.letterSpacing = "1px";
    contentWidth = rd.measureText(text).width + 10 * view.scale + imageWidth();
  }
  if (layout == BUTTON.textOnly) {
    rd.font = "" + fontSize * (view.scaleY + view.scaleX) + "px junk";
    rd.letterSpacing = "1px";
    contentWidth = rd.measureText(text).width;
  }
  if (layout == BUTTON.imageOnly) {
    contentWidth = imageWidth();
  }
  // Firefox places middle-aligned text higher
  const firefoxShift = isFirefox ? fontSize * view.scale * 0.35 : 0;
  const textY =
    faceY + height * 0.5 - fontSize * view.scale * 0.25 + firefoxShift;
  const drawText = (textX) => {
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#000000";
    rd.globalAlpha = textOpacity;
    rd.fillText(text, textX, textY);
    rd.globalAlpha = 1;
  };
  if (layout == BUTTON.textThenImage || layout == BUTTON.textOnly) {
    drawText(
      faceX + width * 0.5 - contentWidth * 0.5 + fontSize * view.scale * 0.3,
    );
  }
  if (layout == BUTTON.textThenImage || layout == BUTTON.imageOnly) {
    rd.globalAlpha = imageOpacity;
    rd.drawImage(
      image,
      faceX + width * 0.5 + contentWidth * 0.5 - imageWidth(),
      imageTop(),
      imageWidth(),
      imageHeight(),
    );
    rd.globalAlpha = 1;
  }
  if (layout == BUTTON.imageThenText) {
    rd.globalAlpha = imageOpacity;
    // the clock of the time buttons sits a little higher
    const raise = text == "Time" || text == "Rewind Time" ? 7 * view.scale : 0;
    rd.drawImage(
      image,
      faceX + width * 0.5 - contentWidth * 0.5,
      imageTop() - raise,
      imageWidth(),
      imageHeight(),
    );
    rd.globalAlpha = 1;
    drawText(
      faceX +
        width * 0.5 +
        contentWidth * 0.5 -
        rd.measureText(text).width -
        fontSize * view.scale * 0.3,
    );
  }
  return clicked;
};

export const AREA = { idle: 0, held: 1, clicked: 2 };

// A touchable area (in pixels) that draws nothing itself: is it held or clicked?
export const touchArea = (id, x, y, width, height) => {
  let state = AREA.idle;
  for (let i = 0; i < Math.max(pointer.count, 1); i++) {
    if (
      pointer.x[i] > x &&
      pointer.x[i] < x + width &&
      pointer.y[i] > y &&
      pointer.y[i] < y + height
    ) {
      if (pointer.down) {
        buttons.pressedBy[i] = id;
        state = AREA.held;
      } else if (buttons.pressedBy[i] == id) {
        state = AREA.clicked;
        buttons.pressedBy[i] = 0;
      }
    } else if (buttons.pressedBy[i] == id) {
      buttons.pressedBy[i] = 0;
    }
  }
  return state;
};

// The music toggle in the top right corner of the menus.
export const drawMusicToggle = () => {
  const x = view.width - 62 * view.scale;
  const y = 4 * view.scale;
  const area = touchArea(4, x, y, 58 * view.scale, 42 * view.scale);
  if (area == AREA.held) {
    rd.globalAlpha = 0.7;
  }
  if (area == AREA.clicked) {
    audio.muteMusic = !audio.muteMusic;
  }
  rd.drawImage(
    images.soundToggles[audio.muteMusic ? 5 : 4],
    x,
    y,
    58 * view.scale,
    42 * view.scale,
  );
  rd.globalAlpha = 1;
};

export const TEXT = { small: 0, label: 1, faintLabel: 2, title: 3, heading: 4 };

// Text centered horizontally at the design height y.
export const drawCenteredText = (y, text, r, g, b, style) => {
  rd.letterSpacing = "0px";
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px verd";
  if (style == TEXT.label || style == TEXT.faintLabel) {
    rd.letterSpacing = "1px";
    rd.font = "" + 13 * (view.scaleY + view.scaleX) + "px junk";
  }
  if (style == TEXT.title) {
    rd.letterSpacing = "1px";
    rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
  }
  if (style == TEXT.heading) {
    rd.letterSpacing = "1px";
    rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
  }
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
  if (style == TEXT.faintLabel) {
    rd.globalAlpha = 0.67;
  }
  rd.fillText(text, 640 * view.scaleX, y * view.scaleY);
  if (style == TEXT.faintLabel) {
    rd.globalAlpha = 1;
  }
};

// A meter like the damage and power bars at (x, y) in pixels: a frame with a gradient
// from edgeTop to edgeBottom, filled to fraction (0..1) with fillColor.
export const drawMeter = (x, y, edgeTop, edgeBottom, fillColor, fraction) => {
  rd.fillStyle = fillColor;
  rd.fillRect(
    x + 7 * view.scale,
    y + 6 * view.scale,
    166 * fraction * view.scale,
    18 * view.scale,
  );
  const gradient = rd.createLinearGradient(x, y, x, y + 30 * view.scale);
  gradient.addColorStop(0, edgeTop);
  gradient.addColorStop(1, edgeBottom);
  rd.fillStyle = gradient;
  rd.beginPath();
  rd.moveTo(x, y);
  rd.lineTo(x - 9 * view.scale, y + 10 * view.scale);
  rd.lineTo(x - 1.5 * view.scale, y + 27 * view.scale);
  rd.lineTo(x + 10 * view.scale, y + 30 * view.scale);
  rd.lineTo(x + 92 * view.scale, y + 30 * view.scale);
  rd.lineTo(x + 92 * view.scale, y + 24 * view.scale);
  rd.lineTo(x + 7 * view.scale, y + 24 * view.scale);
  rd.lineTo(x + 7 * view.scale, y + 6 * view.scale);
  rd.lineTo(x + 92 * view.scale, y + 6 * view.scale);
  rd.lineTo(x + 92 * view.scale, y);
  rd.closePath();
  rd.fill();
  rd.beginPath();
  rd.moveTo(x + 180 * view.scale, y + 30 * view.scale);
  rd.lineTo(x + 189 * view.scale, y + 20 * view.scale);
  rd.lineTo(x + 181.5 * view.scale, y + 3 * view.scale);
  rd.lineTo(x + 170 * view.scale, y);
  rd.lineTo(x + 90 * view.scale, y);
  rd.lineTo(x + 90 * view.scale, y + 6 * view.scale);
  rd.lineTo(x + 173 * view.scale, y + 6 * view.scale);
  rd.lineTo(x + 173 * view.scale, y + 24 * view.scale);
  rd.lineTo(x + 90 * view.scale, y + 24 * view.scale);
  rd.lineTo(x + 90 * view.scale, y + 30 * view.scale);
  rd.closePath();
  rd.fill();
};

// Fills the shape from (startX, startY) through the points from..to-1 to (endX, endY), all
// in design units.
export const fillScaledShape = (
  startX,
  startY,
  xs,
  ys,
  from,
  to,
  endX,
  endY,
) => {
  rd.beginPath();
  rd.moveTo(startX * view.scaleX, startY * view.scaleY);
  for (let i = from; i < to; i++) {
    rd.lineTo(xs[i] * view.scaleX, ys[i] * view.scaleY);
  }
  rd.lineTo(endX * view.scaleX, endY * view.scaleY);
  rd.closePath();
  rd.fill();
};

// Outlines the polygon of the first count points, in design units.
export const strokeScaledPolygon = (xs, ys, count) => {
  rd.beginPath();
  rd.moveTo(xs[0] * view.scaleX, ys[0] * view.scaleY);
  for (let i = 1; i < count; i++) {
    rd.lineTo(xs[i] * view.scaleX, ys[i] * view.scaleY);
  }
  rd.closePath();
  rd.stroke();
};

// Fills the polygon of the first count points, in pixels.
export const fillPolygon = (xs, ys, count) => {
  rd.beginPath();
  rd.moveTo(xs[0], ys[0]);
  for (let i = 1; i < count; i++) {
    rd.lineTo(xs[i], ys[i]);
  }
  rd.closePath();
  rd.fill();
};

// Outlines the polygon of the first count points, in pixels.
export const strokePolygon = (xs, ys, count) => {
  rd.beginPath();
  rd.moveTo(xs[0], ys[0]);
  for (let i = 1; i < count; i++) {
    rd.lineTo(xs[i], ys[i]);
  }
  rd.closePath();
  rd.stroke();
};
