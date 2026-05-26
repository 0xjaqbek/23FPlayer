import { expect, test } from "@playwright/test";

test("redirects unauthenticated users from player to login", async ({ page }) => {
  await page.goto("/player");
  await expect(page).toHaveURL(/\/login/);
});

test.describe.skip("authenticated listener player", () => {
  // TODO: unskip after adding an authenticated storage-state and seeded listener/DJ queue fixture.
  test("loads player, shows queue, and hides voting when queue is empty", async ({ page }) => {
    await page.goto("/player");

    await expect(page.getByRole("heading", { name: /No DJ on air|.+/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "DJ Queue" })).toBeVisible();
    await expect(page.getByText("No DJs waiting.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vote to change DJ" })).toBeHidden();
  });

  test("shows voting when a DJ is live and the queue is not empty", async ({ page }) => {
    await page.goto("/player");

    await expect(page.getByRole("heading", { name: "Change DJ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vote to change DJ" })).toBeVisible();
  });
});
