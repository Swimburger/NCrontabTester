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
  await expect(page.locator(".tool-card").getByRole("alert")).toContainText("invalid crontab expression");
  await expect(printMore).toBeDisabled();

  await input.fill("0 12 * * Mon");
  await expect(page.locator(".tool-card").getByRole("alert")).toContainText("classic five-part CRON format");
  await expect(occurrences).toHaveCount(10);

  await printMore.click();
  await expect(occurrences).toHaveCount(20);
});

test("keeps the advertisement below the tool", async ({ page }) => {
  const ad = page.locator(".ethical-ad-slot");

  await expect(ad).toHaveCount(1);
  await expect(ad.locator("[data-ea-publisher]")).toHaveClass(/\badaptive\b/);
  await expect(ad.locator("[data-ea-publisher]")).toHaveClass(/\braised\b/);
  expect(await page.evaluate(() => {
    const toolElement = document.querySelector(".tool-card");
    const adElement = document.querySelector(".ethical-ad-slot");
    return Boolean(toolElement.compareDocumentPosition(adElement) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});

test("copies a shareable link and reports success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedLink = text;
        },
      },
    });
  });
  await page.reload();
  await expect(page.locator("#crontab-expression")).toBeVisible();

  await page.getByRole("button", { name: "Copy Link" }).click();

  await expect(page.getByRole("status")).toHaveText("Link copied");
  const copiedLink = await page.evaluate(() => window.copiedLink);
  expect(copiedLink).toContain("?expression=0+0+12+*+*/2+Mon");
});

test("reports a clipboard failure without disabling retry", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard access denied", "NotAllowedError");
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.reload();
  await expect(page.locator("#crontab-expression")).toBeVisible();

  const copyButton = page.getByRole("button", { name: "Copy Link" });
  await copyButton.click();

  await expect(page.getByRole("status")).toHaveText("Copy failed");
  await expect(copyButton).toBeEnabled();
});

test("supports zoom, dark mode, and a narrow viewport without Google Analytics", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#crontab-expression")).toBeVisible();

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe("rgb(250, 250, 250)");

  const document = await (await request.get("/")).text();
  expect(document).not.toContain("googletagmanager.com");
  expect(document).not.toContain("google-analytics.com");
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
