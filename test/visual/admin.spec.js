import { expect, test } from "@playwright/test";

test("the lobbies page asks for the token and shows the rooms only with the right one", async ({
  page,
}) => {
  await page.goto("lobbies.html");
  const token = page.getByLabel("Token");
  await expect(token).toBeFocused();
  await expect(page.getByText("No lobby open right now.")).toBeHidden();

  await token.fill("wrong");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong token.");
  await expect(page.getByText("No lobby open right now.")).toBeHidden();

  await token.fill("test-token");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("No lobby open right now.")).toBeVisible();
  await expect(token).toBeHidden();

  // kept for the next visit
  await page.reload();
  await expect(page.getByText("No lobby open right now.")).toBeVisible();
  await expect(token).toBeHidden();
});

test("the rooms report is not given without the token", async ({ request }) => {
  expect((await request.get("net/rooms")).status()).toBe(401);
  const answer = await request.get("net/rooms", {
    headers: { Authorization: "Bearer test-token" },
  });
  expect(answer.status()).toBe(200);
  expect(await answer.json()).toHaveProperty("rooms");
});
