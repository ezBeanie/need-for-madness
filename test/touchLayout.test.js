import { afterEach, expect, test, vi } from "vitest";
import { startRace } from "./harness/race.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PHONE =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Mobile";

// The view of a window this big (as fitToWindow makes it).
const windowOf = (ctx, width, height) =>
  Object.assign(ctx.view, {
    width,
    height,
    aspect: width / height,
    scaleX: width / 1280,
    scaleY: height / 720,
    scale: (width / 1280 + height / 720) / 2,
  });

test("the touch controls are as big as on a large phone at most, and as the player sizes them", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5, userAgent: PHONE });
  // a phone: the original's size for the screen, where it always was
  windowOf(ctx, 844, 390);
  const phone = ctx.touchControlAt("left");
  expect(phone.width).toBeCloseTo(128 * ctx.view.scale);
  expect(phone.x).toBeCloseTo(130 * ctx.view.scaleX);
  // a tablet: no bigger than on a large phone
  windowOf(ctx, 1280, 800);
  expect(ctx.touchControlAt("left").width).toBeCloseTo(96);
  ctx.setTouchSize(1.4);
  expect(ctx.touchControlAt("left").width).toBeCloseTo(96 * 1.4);
  // (no size but those offered)
  ctx.setTouchSize(7);
  expect(ctx.touchLayout.size).toBe(1.4);
  ctx.setTouchSize(1);
  windowOf(ctx, 1280, 720);
});

test("a touch control moved lies where the player put it, on any screen, and is pressed there", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5, userAgent: PHONE });
  const u = ctx.racers[ctx.game.player].u;
  const touch = (x, y) => {
    Object.assign(ctx.pointer, { down: true, count: 1 });
    ctx.pointer.x[0] = x;
    ctx.pointer.y[0] = y;
    ctx.drawHud();
    const held = u.up;
    ctx.pointer.down = false;
    ctx.drawHud();
    return held;
  };
  // the middle of the screen accelerates nothing, its corner does
  expect(touch(640, 360)).toBe(false);
  const corner = ctx.touchControlAt("accelerate");
  expect(touch(corner.x, corner.y)).toBe(true);
  ctx.touchLayout.at.accelerate = [0.5, 0.5];
  expect(ctx.touchControlAt("accelerate")).toMatchObject({ x: 640, y: 360 });
  expect(touch(640, 360)).toBe(true);
  expect(touch(corner.x, corner.y)).toBe(false);
  // (as a share of the screen: folded onto a smaller one it is in its middle still)
  windowOf(ctx, 844, 390);
  expect(ctx.touchControlAt("accelerate")).toMatchObject({ x: 422, y: 195 });
  windowOf(ctx, 1280, 720);
  ctx.touchLayout.at = {};
});

test("a stored layout is read back, and a broken one is the original's", async () => {
  const stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const { ctx } = await startRace({ stage: 1, car: 5, userAgent: PHONE });
  stored.set(
    "touchLayout",
    JSON.stringify({ size: 0.8, at: { left: [0.2, 0.9], brake: [2, 0] } }),
  );
  ctx.loadTouchLayout();
  expect(ctx.touchLayout.size).toBe(0.8);
  expect(ctx.touchLayout.at).toEqual({ left: [0.2, 0.9] });
  stored.set("touchLayout", "{oops");
  ctx.loadTouchLayout();
  expect(ctx.touchLayout).toEqual({ size: 1, at: {} });
});
