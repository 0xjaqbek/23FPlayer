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
