import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// Samsung Internet may keep a page zoomed in, an installed game too: then less of it is on
// screen than the window's size, and the game has to fit what is seen.
test("the game fits the part of a zoomed page that is on screen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const zoomed = new EventTarget();
    Object.assign(zoomed, {
      width: 1280 / 1.25,
      height: 720 / 1.25,
      pageLeft: 30,
      pageTop: 20,
      scale: 1.25,
    });
    Object.defineProperty(window, "visualViewport", { value: zoomed });
  });
  const game = await openGame(page, { storage: { unlocked: "17" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(1);
  for (const id of ["#canvas2D", "#canvas3D"]) {
    const style = await page.locator(id).evaluate((canvas) => ({
      left: canvas.style.left,
      top: canvas.style.top,
      width: canvas.style.width,
      height: canvas.style.height,
    }));
    expect(style).toEqual({
      left: "30px",
      top: "20px",
      width: "1024px",
      height: "576px",
    });
  }
  const view = await page.evaluate(() => [
    document.getElementById("canvas2D").width,
    document.getElementById("canvas2D").height,
  ]);
  expect(view).toEqual([1024, 576]);
});
