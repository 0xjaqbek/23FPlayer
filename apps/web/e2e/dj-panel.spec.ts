import { expect, test } from "@playwright/test";

test("dj panel requires login before showing controls", async ({ page }) => {
  await page.goto("/dj");
  await expect(page).toHaveURL(/\/login/);
});

test("browser audio APIs can be mocked for the dj panel", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        async getUserMedia() {
          return new MediaStream();
        },
        async enumerateDevices() {
          return [
            {
              deviceId: "line-in",
              kind: "audioinput",
              label: "Line In",
              groupId: "default",
              toJSON() {
                return this;
              },
            },
          ];
        },
      },
      configurable: true,
    });
  });

  await page.goto("/dj");
  await expect(page).toHaveURL(/\/login/);
});

test.describe.skip("authenticated dj panel", () => {
  test("renders level meter and queue controls", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          async getUserMedia() {
            return new MediaStream();
          },
          async enumerateDevices() {
            return [
              {
                deviceId: "line-in",
                kind: "audioinput",
                label: "Line In",
                groupId: "default",
                toJSON() {
                  return this;
                },
              },
            ];
          },
        },
        configurable: true,
      });
    });

    await page.goto("/dj");

    await expect(page.getByLabel("Input level meter")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join queue" })).toBeVisible();
  });

  test("shows start broadcast only when eligible", async ({ page }) => {
    await page.goto("/dj");

    await expect(page.getByRole("button", { name: "Start broadcast" })).toBeVisible();
    await expect(page.getByText("You are next to broadcast.")).toBeVisible();
  });
});
