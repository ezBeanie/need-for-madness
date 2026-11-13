import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// A race on stage 3 with all stages unlocked, past the countdown.
const racing = async (page, frames = 200, storage = {}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17", ...storage },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 3;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await game.advance(frames);
  return game;
};

const set = (page, change) => page.evaluate(change);

test("hud: countdown numbers", async ({ page }) => {
  const game = await racing(page, 140);
  await expect.soft(page).toHaveScreenshot("hud-countdown-two.png");
  await game.advance(45);
  await expect.soft(page).toHaveScreenshot("hud-countdown-go.png");
});

// (the classic pictures load once the HUD first asks for them)
const classicCountdown = async (page, storage) => {
  const game = await racing(page, 0, storage);
  for (let i = 0; i < 15; i++) {
    await game.advance(10);
    await page.waitForTimeout(100);
  }
};

test("hud: classic countdown numbers", async ({ page }) => {
  await classicCountdown(page, { look: "1", classicMenus: "1" });
  await expect.soft(page).toHaveScreenshot("hud-classic-countdown-two.png");
});

test("hud: the game's own countdown in the classic look, with the original's Insano", async ({
  page,
}) => {
  await classicCountdown(page, { look: "1" });
  await expect
    .soft(page)
    .toHaveScreenshot("hud-classic-world-countdown-two.png");
});

test("hud: the replay viewer", async ({ page }) => {
  const game = await racing(page, 300);
  await set(page, () => {
    const s = window.gameState;
    s.game.phase = 11;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  });
  await game.advance(60);
  // (the controls show only when asked for)
  await game.tap("h");
  await expect.soft(page).toHaveScreenshot("hud-replay-viewer.png");
});

test("hud: power low and the arrow at the cars", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const r = window.gameState.racers[0];
    r.power = 30;
  });
  await game.advance(3);
  await expect.soft(page).toHaveScreenshot("hud-power-low.png");
  await game.tap("q");
  await game.advance(2);
  await expect.soft(page).toHaveScreenshot("hud-arrow-at-cars.png");
});

test("hud: race won", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const s = window.gameState;
    s.track.clear[0] = s.track.nlaps * s.track.nsp;
    s.racers[0].clear = s.track.nlaps * s.track.nsp;
  });
  await game.advance(30);
  await expect.soft(page).toHaveScreenshot("hud-race-won.png");
});

test("hud: all opponents wasted", async ({ page }) => {
  const game = await racing(page);
  await set(page, async () => {
    const s = window.gameState;
    const { fixcar } = await import("/src/race/physics.js");
    for (let c = 1; c < s.game.carCount; c++) {
      // damage comes from hits, which shape the dents first; fixcar does that too
      fixcar(c);
      s.racers[c].damage = 1e9;
    }
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-all-wasted.png");
});

test("hud: player wasted", async ({ page }) => {
  const game = await racing(page);
  await set(page, async () => {
    const s = window.gameState;
    const { fixcar } = await import("/src/race/physics.js");
    fixcar(0);
    s.racers[0].damage = 1e9;
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-player-wasted.png");
});

test("hud: watching the race on after a wreck, racing together", async ({
  page,
}) => {
  const game = await racing(page);
  await set(page, async () => {
    const s = window.gameState;
    const { fixcar } = await import("/src/race/physics.js");
    // (as a race together has it: people drive)
    s.game.humans = [0];
    fixcar(0);
    s.racers[0].damage = 1e9;
  });
  await game.advance(60);
  // Watch Race, beside Continue
  await expect.soft(page).toHaveScreenshot("hud-wasted-together.png");
  await page.evaluate(() => window.gameState.startWatching());
  await game.advance(20);
  await expect.soft(page).toHaveScreenshot("hud-watching.png");
});

test("hud: the minimap", async ({ page }) => {
  await racing(page, 300, { minimap: "1" });
  await expect.soft(page).toHaveScreenshot("hud-minimap.png");
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test("hud: watching with the free camera, a finger on the pad flies it", async ({
    page,
  }) => {
    const game = await racing(page);
    await set(page, async () => {
      const s = window.gameState;
      const { fixcar } = await import("/src/race/physics.js");
      s.game.humans = [0];
      fixcar(0);
      s.racers[0].damage = 1e9;
    });
    await game.advance(60);
    await page.evaluate(() => {
      const s = window.gameState;
      s.startWatching();
      s.camera.mode = s.CAMERA.free;
    });
    await game.advance(20);
    await expect.soft(page).toHaveScreenshot("hud-watching-free-phone.png");
    const where = () =>
      page.evaluate(() => {
        const { x, z, yaw } = window.gameState.camera;
        return { x, z, yaw };
      });
    const before = await where();
    // a finger at the pad's top: forward, as the camera looks
    await page.evaluate(() => {
      const { pointer, view } = window.gameState;
      const pad = 70 * view.scale;
      const margin = 30 * view.scale;
      pointer.x[0] = margin + pad;
      pointer.y[0] = view.height - margin - pad * 2;
      pointer.count = 1;
      pointer.down = true;
    });
    await game.advance(10);
    await page.evaluate(() => {
      window.gameState.pointer.down = false;
    });
    const after = await where();
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
      100,
    );
    expect(after.yaw).toBe(before.yaw);
  });

  // The fingers on the screen now, by number: those new go down, those gone let go, as the
  // browser tells it (several at once, one lifted while another stays).
  const fingers = (page, points) =>
    page.evaluate(
      (now) => {
        const canvas = document.querySelector("#canvas2D");
        const was = window.fingersDown ?? {};
        const touchOf = (id, [x, y]) =>
          new Touch({
            identifier: Number(id),
            target: canvas,
            clientX: x,
            clientY: y,
          });
        const all = Object.entries(now).map(([id, at]) => touchOf(id, at));
        const send = (type, changed) =>
          changed.length &&
          canvas.dispatchEvent(
            new TouchEvent(type, {
              touches: all,
              changedTouches: changed,
              cancelable: true,
            }),
          );
        send(
          "touchend",
          Object.keys(was)
            .filter((id) => !(id in now))
            .map((id) => touchOf(id, was[id])),
        );
        send(
          "touchstart",
          Object.keys(now)
            .filter((id) => !(id in was))
            .map((id) => touchOf(id, now[id])),
        );
        window.fingersDown = now;
      },
      Object.fromEntries(
        points.map((point, i) => [i, point]).filter(([, point]) => point),
      ),
    );

  test("with the target camera on, a car tapped is chosen while a finger drives, tapped again none, and the bar at the top chooses too", async ({
    page,
  }) => {
    const game = await racing(page);
    await set(page, () => {
      window.gameState.camera.aims = true;
    });
    await game.advance(2);
    // where the accelerator is, and a car put ahead in the picture
    const gas = await page.evaluate(() => {
      const { x, y } = window.gameState.touchControlAt("accelerate");
      const box = document.querySelector("#canvas2D").getBoundingClientRect();
      return [box.left + x, box.top + y];
    });
    const C = 3;
    const putAhead = () =>
      page.evaluate((c) => {
        const { car, camera, game } = window.gameState;
        const own = car[game.player];
        const yaw = (camera.yaw * Math.PI) / 180;
        car[c].x = own.x + 400 * Math.sin(yaw);
        car[c].z = own.z - 400 * Math.cos(yaw);
        car[c].y = own.y;
        // (the others far off, out of the picture)
        for (let other = 0; other < game.carCount; other++) {
          if (other != c && other != game.player) {
            car[other].x = own.x - 20000 * Math.sin(yaw) + 3000 * other;
            car[other].z = own.z + 20000 * Math.cos(yaw);
          }
        }
      }, C);
    const spot = () =>
      page.evaluate((c) => {
        const { left, top } = window.gameState.carOnScreen(c);
        return [left, top];
      }, C);
    const state = () =>
      page.evaluate(() => {
        const { camera, racers, game } = window.gameState;
        return { locked: camera.lockedCar, gas: racers[game.player].u.up };
      });

    await fingers(page, [gas]);
    await game.advance(2);
    await putAhead();
    await game.advance(1);
    const car = await spot();
    // a second finger taps the car, the first stays on the gas
    await fingers(page, [gas, car]);
    await fingers(page, [gas]);
    await game.advance(1);
    expect(await state()).toEqual({ locked: C, gas: true });

    await putAhead();
    await game.advance(1);
    const again = await spot();
    await fingers(page, [gas, again]);
    await fingers(page, [gas]);
    await game.advance(1);
    expect(await state()).toEqual({ locked: -1, gas: true });

    // the bar's arrow to the farther car, at the top, big enough for a finger
    const next = await page.evaluate(() => {
      const { view, rd } = window.gameState;
      const box = document.querySelector("#canvas2D").getBoundingClientRect();
      const height = Math.max(44, 30 * view.scale);
      rd.save();
      rd.font = `${Math.round(height * 0.45)}px sans-serif`;
      const name = Math.max(
        rd.measureText("🎯 none").width + height * 0.9,
        140 * view.scale,
      );
      rd.restore();
      return {
        x:
          box.left + view.width / 2 + name / 2 + 4 * view.scale + height * 0.65,
        y: box.top + 8 * view.scale + height / 2,
        height,
      };
    });
    expect(next.height).toBeGreaterThanOrEqual(44);
    expect(next.y).toBeLessThan(390 / 2);
    await expect.soft(page).toHaveScreenshot("hud-target-bar-phone.png");
    const nearest = await page.evaluate(() => {
      const { car, game } = window.gameState;
      const own = car[game.player];
      const distance = (c) => Math.hypot(car[c].x - own.x, car[c].z - own.z);
      let best = -1;
      for (let c = 0; c < game.carCount; c++) {
        if (c != game.player && (best < 0 || distance(c) < distance(best))) {
          best = c;
        }
      }
      return best;
    });
    await fingers(page, [gas, [next.x, next.y]]);
    await fingers(page, [gas]);
    await game.advance(1);
    expect(await state()).toEqual({ locked: nearest, gas: true });
    await fingers(page, []);
  });
});

// What the HUD draws in a frame, each text, bar, picture and filled box with where it lies.
const recordHudBoxes = (page) =>
  page.addInitScript(() => {
    window.hudBoxes = [];
    const proto = CanvasRenderingContext2D.prototype;
    const record = (context, kind, what, left, top, right, bottom) => {
      if (context.canvas.id == "canvas2D" && context.globalAlpha > 0) {
        window.hudBoxes.push({ kind, what, left, top, right, bottom });
      }
    };
    const { fillText, roundRect, drawImage, fillRect } = proto;
    proto.fillText = function (text, x, y, ...rest) {
      const m = this.measureText(text);
      record(
        this,
        "text",
        String(text),
        x - m.actualBoundingBoxLeft,
        y - m.actualBoundingBoxAscent,
        x + m.actualBoundingBoxRight,
        y + m.actualBoundingBoxDescent,
      );
      return fillText.call(this, text, x, y, ...rest);
    };
    proto.roundRect = function (x, y, width, height, ...rest) {
      record(this, "bar", "", x, y, x + width, y + height);
      return roundRect.call(this, x, y, width, height, ...rest);
    };
    proto.fillRect = function (x, y, width, height) {
      record(this, "box", "", x, y, x + width, y + height);
      return fillRect.call(this, x, y, width, height);
    };
    proto.drawImage = function (image, ...args) {
      // (where it goes: the last four numbers, or two with the picture's own size)
      const [x, y, width = image.width, height = image.height] =
        args.length > 4 ? args.slice(4) : args;
      record(this, "picture", "", x, y, x + width, y + height);
      return drawImage.call(this, image, ...args);
    };
  });

// The pairs of things drawn over each other, but for one inside the other (a text in its
// bar) and a text drawn over itself (as a shadow).
const overlapsOf = (boxes) => {
  const inside = (a, b) =>
    a.left >= b.left - 1 &&
    a.right <= b.right + 1 &&
    a.top >= b.top - 1 &&
    a.bottom <= b.bottom + 1;
  const over = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const name = ({ kind, what, left, top }) =>
    `${kind} ${what} at ${Math.round(left)},${Math.round(top)}`;
  const found = [];
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => {
      const sameText = a.kind == "text" && b.kind == "text" && a.what == b.what;
      if (over(a, b) && !inside(a, b) && !inside(b, a) && !sameText) {
        found.push(`${name(a)} / ${name(b)}`);
      }
    }),
  );
  return found;
};

// A room's race of most kills with its HUD as full as it gets: the board, the feed, the
// minimap, the target camera's bar, the player wasted and waiting to come back, and a game
// waited for. Returns what the HUD drew in that frame.
const fullMostKillsHud = async (page) => {
  await recordHudBoxes(page);
  const game = await racing(page, 200, { minimap: "1" });
  await set(page, () => {
    const s = window.gameState;
    s.game.humans = [0];
    s.raceSetup.mode = s.RACE_MODE.mostKills;
    s.startDeathmatch();
    s.setRoomCars(
      Array.from({ length: s.game.carCount }, (_, c) => `Player ${c + 1}`),
      [],
    );
    s.camera.aims = true;
    for (let c = 1; c < 6; c++) {
      s.deathmatch.kills[c] = c;
      s.noteWreck(c, c + 1);
    }
  });
  await game.advance(2);
  await set(page, () => {
    const s = window.gameState;
    s.racers[s.game.player].wasted = true;
    s.deathmatch.backAt[s.game.player] = s.deathmatch.ticks + 200;
    window.hudBoxes = [];
  });
  await game.advance();
  return page.evaluate(() => {
    window.gameState.drawNetNotice(["Waiting for Player 2..."], 120);
    return window.hudBoxes;
  });
};

const FULL_HUD = ["You're Wasted!", "Waiting for Player 2...", "Ping 120 ms"];

test("hud: nothing of a full HUD of most kills lies over anything else", async ({
  page,
}) => {
  const boxes = await fullMostKillsHud(page);
  for (const text of FULL_HUD) {
    expect(boxes.some(({ what }) => what == text)).toBe(true);
  }
  expect(overlapsOf(boxes)).toEqual([]);
});

test.describe("on a phone, most kills", () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test("hud: nothing of a full HUD of most kills lies over anything else on a phone", async ({
    page,
  }) => {
    const boxes = await fullMostKillsHud(page);
    for (const text of FULL_HUD) {
      expect(boxes.some(({ what }) => what == text)).toBe(true);
    }
    expect(overlapsOf(boxes)).toEqual([]);
  });
});

test("hud: the ping drawn over a race waiting, as it was drawn last, shows only the new one", async ({
  page,
}) => {
  const game = await openGame(page);
  await game.advanceUntil(PHASE.mainMenu);
  const bottom = () =>
    page.evaluate(() => {
      const { rd, view } = window.gameState;
      const top = Math.floor(680 * view.scaleY);
      return Array.from(
        rd.getImageData(0, top, view.width, view.height - top).data,
      );
    });
  const drawn = (pings) =>
    page.evaluate((pings) => {
      const { drawNetNotice, rd, view } = window.gameState;
      rd.clearRect(0, 0, view.width, view.height);
      for (const ping of pings) {
        drawNetNotice([], ping);
      }
    }, pings);
  await drawn([250, 1234]);
  const over = await bottom();
  await drawn([1234]);
  expect(over).toEqual(await bottom());
});

test("hud: in a bunch of cars, a name lies over no other", async ({ page }) => {
  const game = await racing(page);
  const put = () =>
    set(page, () => {
      const { car, camera, game } = window.gameState;
      const own = car[game.player];
      const yaw = (camera.yaw * Math.PI) / 180;
      // the others in a bunch ahead, each a little behind the one before, to its side
      for (let c = 0, n = 0; c < game.carCount; c++) {
        if (c != game.player) {
          const ahead = 900 + 20 * n;
          const aside = n % 2 ? 30 : -30;
          car[c].x = own.x + ahead * Math.sin(yaw) + aside * Math.cos(yaw);
          car[c].z = own.z - ahead * Math.cos(yaw) + aside * Math.sin(yaw);
          car[c].y = own.y;
          n++;
        }
      }
    });
  await set(page, () => {
    const s = window.gameState;
    s.game.humans = [0];
    s.setRoomCars(
      Array.from({ length: s.game.carCount }, (_, c) => `Player ${c + 1}`),
      [],
    );
  });
  await put();
  await game.advance(1);
  await put();
  await game.advance(1);
  const tags = await page.evaluate(() =>
    [...document.querySelectorAll(".name-tag")]
      .filter((tag) => !tag.hidden)
      .map((tag) => {
        const { left, right, top, bottom } = tag.getBoundingClientRect();
        return { left, right, top, bottom };
      }),
  );
  expect(tags.length).toBeGreaterThan(0);
  const over = tags.filter((a, i) =>
    tags.some(
      (b, j) =>
        i != j &&
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom,
    ),
  );
  expect(over).toEqual([]);
});
