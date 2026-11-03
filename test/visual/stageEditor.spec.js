import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// the stage being edited, the first of the player's
const draft = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("myStages"))[0]);

// the pieces set, as the stage file has them
const pieces = async (page) =>
  (await draft(page)).split("\n").filter((line) => line.startsWith("set("));

test("stage editor: pieces placed from the palette join the start end to end", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  expect(await game.phase()).toBe(PHASE.stageEditor);
  // the shapes arrive
  await page.waitForFunction(
    () =>
      document.querySelector("#editorStatus").textContent.includes("1 piece"),
    null,
    { polling: 50 },
  );
  await page.waitForTimeout(500);

  const map = await page.locator("#editorMap").boundingBox();
  const middle = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
  // a road a little off the start's front, and a turn a little off the road's
  await page.click('#editorPalette button[data-piece="10"]');
  await page.mouse.move(middle.x + 6, middle.y - 175);
  await page.mouse.click(middle.x + 6, middle.y - 175);
  await page.click('#editorPalette button[data-piece="14"]');
  await page.mouse.move(middle.x + 3, middle.y - 300);
  await page.mouse.click(middle.x + 3, middle.y - 300);
  await page.keyboard.press("Escape");
  expect(await pieces(page)).toEqual([
    "set(47,0,0,0)p",
    "set(10,0,5600,0)p",
    "set(14,0,10150,0)pt",
  ]);
  // turned and taken back
  await page.keyboard.press("r");
  expect((await pieces(page))[2]).toBe("set(14,0,10150,90)pt");
  await page.keyboard.press("Control+z");
  expect((await pieces(page))[2]).toBe("set(14,0,10150,0)pt");
  await expect.soft(page).toHaveScreenshot("stage-editor.png");

  // the turn is not the start: made the start, it is the path's first point
  await expect(page.locator("#editorProblems")).toContainText(
    "A lap needs at least one checkpoint.",
  );
  await page.mouse.click(middle.x, middle.y - 300);
  await page.click("#editorMakeStart");
  expect((await pieces(page))[0]).toBe("set(14,0,10150,0)pt");
  await expect(page.locator("#editorProblems")).toContainText(
    "The path should begin on a start piece.",
  );
  // ordered again by clicking the pieces in the order the cars drive them
  await page.click("#editorOrder");
  for (const dy of [0, -175, -300]) {
    await page.mouse.click(middle.x, middle.y + dy);
  }
  await page.keyboard.press("Escape");
  expect(await pieces(page)).toEqual([
    "set(47,0,0,0)p",
    "set(10,0,5600,0)p",
    "set(14,0,10150,0)pt",
  ]);
  // the turn a path point the AI drives through, no corner to cut
  await page.selectOption("#editorPathKind", "p");
  expect((await pieces(page))[2]).toBe("set(14,0,10150,0)p");

  // the settings: laps, and the look of stage 17
  await page.click("#editorSettingsButton");
  await page.fill("#settingLaps", "5");
  await page.locator("#settingLaps").blur();
  await page.selectOption("#settingLookFrom", "17");
  await page.click("#settingCopyLook");
  await expect(page.locator("#settingSky")).toHaveValue("#99caff");
  await expect.soft(page).toHaveScreenshot("stage-editor-settings.png");
  await page.click("#editorSettings .close");
  // (stage 17 sees 11700 far, off the field's steps: it closes all the same)
  await expect(page.locator("#editorSettings")).toBeHidden();
  const text = await draft(page);
  expect(text).toContain("nlaps(5)");
  expect(text).toContain("sky(153,202,255)");
  expect(await page.isVisible("#stageEditor")).toBe(true);

  // Escape with nothing to place closes it, back to the main menu
  await page.mouse.click(map.x + 20, map.y + 20);
  await page.keyboard.press("Escape");
  // (the dialog's close event comes after it closed; polled by time, as the driver holds
  // the animation frames back)
  await page.waitForFunction(() => window.gameState.game.phase == 1, null, {
    polling: 50,
  });
  await game.advance();
  expect(await page.isVisible("#menuStageEditor")).toBe(true);
});

test("stage editor: a test drive races the stage from the stage select, and the editor comes back after", async ({
  page,
}) => {
  const stage = await (
    await fetch(
      "http://localhost:" +
        (process.env.PLAYWRIGHT_PORT ?? 5181) +
        "/data/stages/1.txt",
    )
  ).text();
  const game = await openGame(page, {
    storage: { carsel: "5", stageEditorDraft: stage },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  await expect(page.locator("#editorProblems")).toContainText("Ready to race.");
  await page.click("#editorTestDrive");
  await game.advanceUntil(PHASE.stageSelect);
  expect(
    await page.evaluate(() => [
      window.gameState.track.stage,
      window.gameState.track.name,
      window.gameState.track.n,
    ]),
  ).toEqual([52, "Introductory Stage", 22]);
  // quit: the editor is back, as it was
  await page.evaluate(() => {
    window.gameState.game.phase = 1;
  });
  await game.advance();
  expect(await game.phase()).toBe(PHASE.stageEditor);
  expect(await page.isVisible("#stageEditor")).toBe(true);
  await expect(page.locator("#editorName")).toHaveValue("Introductory Stage");
});

test("stage editor: the player's stages are made, copied from the game's, opened from files and deleted", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  const stages = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("myStages")));
  const names = async () =>
    (await stages()).map((text) => text.match(/name\((.*)\)/)?.[1]);
  await page.click("#editorStagesButton");
  await page.click("#stagesNew");
  await page.selectOption("#stagesFrom", "3");
  await page.click("#stagesCopyGame");
  await expect(page.locator("#editorStageList li")).toHaveCount(3);
  expect(await names()).toEqual([
    "My Stage",
    "My Stage",
    "Wrong Side of the Law",
  ]);
  // the original's multiplayer stage with the net, from its file
  await page.setInputFiles(
    "#stagesImport",
    new URL("../../public/data/classic/stages/29.txt", import.meta.url)
      .pathname,
  );
  await expect(page.locator("#editorStageList li")).toHaveCount(4);
  await expect(page.locator("#editorName")).toHaveValue(/./);
  expect((await stages())[3]).toContain("set(76,");
  await expect.soft(page).toHaveScreenshot("stage-editor-stages.png");
  // deleted after asking
  page.once("dialog", (dialog) => dialog.accept());
  await page.click(
    '#editorStageList button[aria-label="Delete My Stage"] >> nth=0',
  );
  await expect(page.locator("#editorStageList li")).toHaveCount(3);
  expect(await names()).toEqual([
    "My Stage",
    "Wrong Side of the Law",
    (await names())[2],
  ]);
});

test("stage editor: the keys select along the path, move, turn, copy and change pieces, and the help explains them", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  await page.waitForFunction(
    () =>
      document.querySelector("#editorStatus").textContent.includes("1 piece"),
    null,
    { polling: 50 },
  );
  await page.focus("#editorMap");
  await page.keyboard.press("?");
  await expect(page.locator("#editorHelp")).toBeVisible();
  await expect.soft(page).toHaveScreenshot("stage-editor-help.png");
  await page.keyboard.press("Escape");
  await expect(page.locator("#editorHelp")).toBeHidden();
  expect(await page.isVisible("#stageEditor")).toBe(true);

  // the start selected as the path's first point, moved a step up and far right
  await page.keyboard.press(".");
  await expect(page.locator("#editorStatus")).toContainText("selected");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Shift+ArrowRight");
  expect(await pieces(page)).toEqual(["set(47,1000,100,0)p"]);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  // (undoing lets go of it) its path point's kind changed, turned left
  await page.keyboard.press(".");
  await page.keyboard.press("p");
  await page.keyboard.press("Shift+R");
  expect(await pieces(page)).toEqual(["set(47,0,0,-90)pt"]);
  // another of it to place, turned the same
  await page.keyboard.press("d");
  await expect(page.locator("#editorStatus")).toContainText("Placing Start");
  await page.keyboard.press("Escape");
  // ordering the path on and off
  await page.keyboard.press("o");
  await expect(page.locator("#editorOrder")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("o");
  await expect(page.locator("#editorOrder")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // Escape lets go of the piece first, the editor stays
  await page.keyboard.press(".");
  await page.keyboard.press("Escape");
  await expect(page.locator("#editorStatus")).toContainText("1 piece");
  expect(await page.isVisible("#stageEditor")).toBe(true);
});

// the stage the editor has open
const opened = (page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("myStages"))[
        Number(localStorage.getItem("myStageOpen"))
      ],
  );

const openedPieces = async (page) =>
  (await opened(page)).split("\n").filter((line) => line.startsWith("set("));

// the editor opened on a stage of the game's, copied
const editStage = async (page, stage) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  await page.click("#editorStagesButton");
  await page.locator("#stagesFrom").selectOption(String(stage));
  await page.click("#stagesCopyGame");
  await expect(page.locator("#editorName")).not.toHaveValue("My Stage");
  await page.keyboard.press("Escape");
  return game;
};

// (time for the shapes and the pictures, between the game's ticks)
const settle = async (game, page, ticks = 6) => {
  for (let i = 0; i < ticks; i++) {
    await game.advance(2);
    await page.waitForTimeout(50);
  }
};

test("stage editor: the 3D view shows the stage built as it is, flown over with the keys", async ({
  page,
}) => {
  const game = await editStage(page, 3);
  await page.locator("#editorMap").focus();
  await page.keyboard.press("v");
  await expect(page.locator("#editor3D")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await settle(game, page);
  // the stage file's pieces built, as the race builds them
  const builtAt = () =>
    page.evaluate(() =>
      window.gameState.pieces.list
        .slice(0, window.gameState.pieces.count)
        .map(({ typ, x, z }) => `${typ + 10},${-x * 10},${z * 10}`),
    );
  const placed = (lines) =>
    lines.map((line) =>
      line
        .match(/^set\((\d+),(-?\d+),(-?\d+)/)
        .slice(1)
        .join(","),
    );
  const built = await builtAt();
  for (const piece of placed(await openedPieces(page))) {
    expect(built).toContain(piece);
  }
  const where = () =>
    page.evaluate(() => {
      const { x, z, yaw } = window.gameState.camera;
      return { x, z, yaw };
    });
  const before = await where();
  await page.keyboard.down("KeyW");
  await game.advance(10);
  await page.keyboard.up("KeyW");
  const after = await where();
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    100,
  );
  expect(after.yaw).toBe(before.yaw);
  // a piece placed from the palette: back on the map, the 3D view built anew with it
  await page.click('#editorPalette button[data-piece="10"]');
  await expect(page.locator("#editor3D")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const map = await page.locator("#editorMap").boundingBox();
  await page.mouse.click(map.x + 40, map.y + 40);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await settle(game, page);
  const [newest] = placed((await openedPieces(page)).slice(-1));
  expect(built).not.toContain(newest);
  expect(await builtAt()).toContain(newest);
});

// (seen: how many of the picture's pixels are drawn)
const previewSeen = (page) =>
  page.evaluate(() => {
    const canvas = document.getElementById("editorPiecePreview");
    const { data } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    let seen = 0;
    for (let i = 3; i < data.length; i += 4) {
      seen += data[i] > 0 ? 1 : 0;
    }
    return seen;
  });

test("stage editor: the piece about to be placed and the one selected show in 3D, a fix hoop's height on a slider", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#menuStageEditor");
  await expect(page.locator("#editorPreview")).toBeHidden();
  await page.click('#editorPalette button[data-piece="41"]');
  await settle(game, page);
  await expect(page.locator("#editorPreview")).toBeVisible();
  expect(await previewSeen(page)).toBeGreaterThan(1000);
  const map = await page.locator("#editorMap").boundingBox();
  await page.mouse.click(map.x + map.width / 2, map.y + 60);
  await page.keyboard.press("Escape");
  await page.mouse.click(map.x + map.width / 2, map.y + 60);
  await expect(page.locator("#editorSelected")).toContainText("Fix hoop");
  const hoop = async () =>
    (await draft(page)).split("\n").find((line) => line.startsWith("fix("));
  expect(await hoop()).toMatch(/^fix\(41,-?\d+,-?\d+,-1200,/);
  // dragged, one change to undo
  const slider = page.locator("#editorHeightSlider");
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  const height = Number(
    (await hoop()).match(/^fix\(41,-?\d+,-?\d+,(-?\d+)/)[1],
  );
  expect(height).toBeLessThan(-3000);
  await expect(page.locator("#editorHeight")).toHaveValue(String(-height));
  await page.click("#editorUndo");
  expect(await hoop()).toMatch(/^fix\(41,-?\d+,-?\d+,-1200,/);
});

test("stage editor: the path's list selects and moves its points, turns the lap round and orders it by place", async ({
  page,
}) => {
  await editStage(page, 1);
  const path = page.locator("#editorPath li");
  const count = await path.count();
  expect(count).toBeGreaterThan(5);
  const order = async () =>
    (await openedPieces(page)).filter((line) => /\)p[thor]?$/.test(line));
  const before = await order();
  // turned round: the start stays first, the rest the other way
  await page.click("#editorReverse");
  const reversed = await order();
  expect(reversed[0]).toBe(before[0]);
  expect(reversed.slice(1)).toEqual(before.slice(1).reverse());
  await page.click("#editorReverse");
  expect(await order()).toEqual(before);
  // the second point a step later, by its list's button
  await page.getByRole("button", { name: /^Later: 2\./ }).click();
  const moved = await order();
  expect(moved[1]).toBe(before[2]);
  expect(moved[2]).toBe(before[1]);
  await expect(page.getByRole("button", { name: /^Later: 3\./ })).toBeFocused();
  // ordered by place: from the start, each time the nearest point left
  await page.click("#editorOrderByPlace");
  const points = (await order()).map((line) =>
    line
      .match(/^set\(\d+,(-?\d+),(-?\d+)/)
      .slice(1)
      .map(Number),
  );
  expect(points[0]).toEqual(
    before[0]
      .match(/^set\(\d+,(-?\d+),(-?\d+)/)
      .slice(1)
      .map(Number),
  );
  const far = ([x0, z0], [x1, z1]) => Math.hypot(x1 - x0, z1 - z0);
  points.slice(1).forEach((point, k) => {
    for (const later of points.slice(k + 2)) {
      expect(far(points[k], point)).toBeLessThanOrEqual(far(points[k], later));
    }
  });
  // a point of the list selects its piece
  await path.nth(3).getByRole("button").first().click();
  await expect(path.nth(3).getByRole("button").first()).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator("#editorSelected")).toContainText(
    `Point 4 of ${count}`,
  );
});
