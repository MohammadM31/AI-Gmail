import { test, expect } from "@playwright/test";

const base = process.env.PLAYWRIGHT_BASE_URL;
const email = process.env.PLAYWRIGHT_EMAIL;
const password = process.env.PLAYWRIGHT_PASSWORD;
const recipient = process.env.PLAYWRIGHT_RECIPIENT;

test("compose a short note, send it, and undo", async ({ page }) => {
  test.skip(
    !base || !email || !password || !recipient,
    "Set PLAYWRIGHT_BASE_URL, PLAYWRIGHT_EMAIL, PLAYWRIGHT_PASSWORD, and PLAYWRIGHT_RECIPIENT"
  );

  await page.goto("/");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByLabel("Message").fill("Team standup is on the calendar.");
  await page.getByPlaceholder("teammate@raidtechs.com").fill(recipient!);
  await page.getByPlaceholder("teammate@raidtechs.com").press("Enter");
  await page.getByRole("button", { name: "✨ Generate" }).click();
  await expect(page.getByRole("button", { name: "📤 Send" })).toBeEnabled({ timeout: 60_000 });

  await page.getByRole("button", { name: "📤 Send" }).click();
  const confirm = page.getByRole("button", { name: "These are correct, send" });
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }

  await page.getByRole("button", { name: "Undo" }).click({ timeout: 10_000 });
});
