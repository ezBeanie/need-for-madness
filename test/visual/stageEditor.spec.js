import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

const draft = (page) =>
  page.evaluate(() => localStorage.getItem("stageEditorDraft"));

// the pieces set, as the stage file has them
const pieces = async (page) =>
  (await draft(page)).split("\n").filter((line) => line.startsWith("set("));

test("stage editor: pieces placed from the palette join the start end to end", async ({
  page,
}) => {
  const game = await openGame(page);
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance();
  await page.click("#stageEditorButton");
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
  expect(await page.isVisible("#stageEditorButton")).toBe(true);
});
