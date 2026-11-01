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
  await page.waitForFunction(() =>
    document.querySelector("#editorStatus").textContent.includes("1 piece"),
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

  // Escape with nothing to place closes it, back to the main menu
  await page.keyboard.press("Escape");
  await game.advance();
  expect(await game.phase()).toBe(PHASE.mainMenu);
});
