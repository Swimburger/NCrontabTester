import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#crontab-expression")).toBeVisible();
});

test("publishes complete metadata without external presentation assets", async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://ncrontab.swimburger.net/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://ncrontab.swimburger.net/SocialImage.png");
  await expect(page.locator('link[href*="cdn.jsdelivr.net"], script[src*="cdn.jsdelivr.net"]')).toHaveCount(0);
  await expect(page.locator('img[src^="https://swimburger.net/content"], link[href^="https://swimburger.net/content"]')).toHaveCount(0);
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

test("does not load advertising", async ({ page }) => {
  await expect(page.locator("[data-ea-publisher]")).toHaveCount(0);
  await expect(page.locator('script[src*="ethicalads"]')).toHaveCount(0);
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
  expect(root.headers()["content-security-policy"]).toBe("base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  expect(root.headers()["permissions-policy"]).toContain("camera=()");
  expect(root.headers()["x-frame-options"]).toBe("DENY");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toBe("User-agent: *\nAllow: /\n");

  const socialImage = await request.get("/SocialImage.png");
  expect(socialImage.status()).toBe(200);
  expect(socialImage.headers()["content-type"]).toContain("image/png");

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
