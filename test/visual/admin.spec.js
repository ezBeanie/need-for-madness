import { readFileSync } from "node:fs";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";
import { expect, test } from "@playwright/test";

test("the admin page asks for the token and shows the rooms and the games opened only with the right one", async ({
  page,
}) => {
  // (the old address leads there)
  await page.goto("lobbies.html");
  await expect(page).toHaveURL(/admin\.html$/);
  const token = page.getByLabel("Token");
  await expect(token).toBeFocused();
  await expect(page.getByText("No lobby open right now.")).toBeHidden();
  // (nothing but the token's field before it is taken)
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.locator("#visitsTotal")).toBeHidden();

  await token.fill("wrong");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong token.");
  await expect(page.getByText("No lobby open right now.")).toBeHidden();

  await token.fill("test-token");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("No lobby open right now.")).toBeVisible();
  await expect(token).toBeHidden();
  await expect(page.locator("#visitsTotal")).toHaveText(/games? opened\./);

  // kept for the next visit
  await page.reload();
  await expect(page.getByText("No lobby open right now.")).toBeVisible();
  await expect(token).toBeHidden();

  // logged out: forgotten, asked for again
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(token).toBeFocused();
  await expect(page.locator("#visitsTotal")).toBeHidden();
  await page.reload();
  await expect(token).toBeVisible();
  await expect(page.getByText("No lobby open right now.")).toBeHidden();
});

test("the rooms report is not given without the token", async ({ request }) => {
  expect((await request.get("net/rooms")).status()).toBe(401);
  const answer = await request.get("net/rooms", {
    headers: { Authorization: "Bearer test-token" },
  });
  expect(answer.status()).toBe(200);
  expect(await answer.json()).toHaveProperty("rooms");
});

test("a game opened is told to the server, which takes only a visit as it should be", async ({
  request,
}) => {
  expect((await request.get("net/visit")).status()).toBe(405);
  const post = (data) => request.post("net/visit", { data });
  const visit = {
    player: "c3c3c3c3c3c3c3c3",
    session: "71717171",
    name: "",
    version: "1.3.4",
    device: "phone",
    installed: false,
  };
  expect((await post({ ...visit, device: "fridge" })).status()).toBe(400);
  expect((await post(visit)).status()).toBe(204);
  const report = await (
    await request.get("net/rooms", {
      headers: { Authorization: "Bearer test-token" },
    })
  ).json();
  expect(report.visits.total).toBeGreaterThan(0);
  expect(report.visits.players).toBeGreaterThan(0);
  expect(JSON.stringify(report.visits)).not.toContain("address");
});

test("the game tells the server it was opened by a player it keeps, and the races begun there", async ({
  page,
}) => {
  const posted = (path) =>
    page.waitForRequest(
      (request) => request.url().endsWith(path) && request.method() == "POST",
    );
  const opened = posted("/net/visit");
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const visit = (await opened).postDataJSON();
  expect(visit).toMatchObject({
    version,
    device: "desktop",
    installed: false,
    name: "",
  });
  expect(visit.player).toMatch(/^[0-9a-f]{16}$/);
  expect(visit.session).toMatch(/^[0-9a-f]{16}$/);
  expect(await page.evaluate(() => localStorage.getItem("playerId"))).toBe(
    visit.player,
  );

  const raced = posted("/net/event");
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuPractice").click();
  await game.advanceUntil(PHASE.carSelect);
  await game.advance(40);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.stageSelect);
  await game.advance(190);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.race, 4000);
  const event = (await raced).postDataJSON();
  expect(event).toMatchObject({
    player: visit.player,
    session: visit.session,
    kind: "race",
    detail: { kind: "practice", car: "MAX Revenge", players: 1 },
  });
});
