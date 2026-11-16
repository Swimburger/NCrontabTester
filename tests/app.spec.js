import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#crontab-expression")).toBeVisible();
});

test("evaluates valid and invalid cron expressions", async ({ page }) => {
  const input = page.locator("#crontab-expression");
  const occurrences = page.locator(".occurrences-list li");
  const printMore = page.getByRole("button", { name: "Print More" });

  await expect(occurrences).toHaveCount(10);

  await input.fill("not a cron");
  await expect(page.getByRole("alert")).toContainText("invalid crontab expression");
  await expect(printMore).toBeDisabled();

  await input.fill("0 12 * * Mon");
  await expect(page.getByRole("alert")).toContainText("classic five-part CRON format");
  await expect(occurrences).toHaveCount(10);

  await printMore.click();
  await expect(occurrences).toHaveCount(20);
});

test("serves the app with Cloudflare routing and headers", async ({ page, request }) => {
  const root = await request.get("/");
  expect(root.status()).toBe(200);
  expect(root.headers()["cache-control"]).toContain("must-revalidate");
  expect(root.headers()["x-content-type-options"]).toBe("nosniff");
  expect(root.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  const deepLink = await request.get("/deep/link", {
    headers: { Accept: "text/html" },
  });
  expect(deepLink.status()).toBe(200);
  expect(await deepLink.text()).toBe(await root.text());

  await page.goto("/");
  await expect(page.locator("#crontab-expression")).toBeVisible();
  const wasmUrl = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => url.endsWith(".wasm")),
  );
  expect(wasmUrl).toBeTruthy();

  const wasm = await request.get(wasmUrl);
  expect(wasm.status()).toBe(200);
  expect(wasm.headers()["content-type"]).toContain("application/wasm");
  expect(wasm.headers()["cache-control"]).toContain("immutable");
});
