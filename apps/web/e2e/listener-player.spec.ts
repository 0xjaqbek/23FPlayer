import { expect, test } from "@playwright/test";

test("redirects unauthenticated users from player to login", async ({ page }) => {
  await page.goto("/player");
  await expect(page).toHaveURL(/\/login/);
});
