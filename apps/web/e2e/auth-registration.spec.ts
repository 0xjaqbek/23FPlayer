import { expect, test } from "@playwright/test";

test("registration hides account fields until access password succeeds", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Registration Access" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeHidden();

  await page.getByLabel("Access password").fill("wrong");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("alert")).toContainText("Invalid registration access");
});
