import { readFileSync } from "node:fs";
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
  expect((await post({ version: "1.3.3", device: "fridge" })).status()).toBe(
    400,
  );
  expect(
    (
      await post({ version: "1.3.3", device: "phone", installed: false })
    ).status(),
  ).toBe(204);
  const report = await (
    await request.get("net/rooms", {
      headers: { Authorization: "Bearer test-token" },
    })
  ).json();
  expect(report.visits.total).toBeGreaterThan(0);
  expect(report.visits.latest[0]).not.toHaveProperty("address");
});

test("the game tells the server it was opened, with its version and device", async ({
  page,
}) => {
  const told = page.waitForRequest(
    (request) =>
      request.url().endsWith("/net/visit") && request.method() == "POST",
  );
  await page.goto("/");
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  expect((await told).postDataJSON()).toEqual({
    version,
    device: "desktop",
    installed: false,
  });
});
