import { expect, test } from "@playwright/test";

function contrastRatio(first, second) {
  const luminance = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#crontab-expression")).toBeVisible();
});

test("publishes complete metadata without external presentation assets", async ({ page }) => {
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light dark");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://ncrontab.swimburger.net/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://ncrontab.swimburger.net/SocialImage.png");
  await expect(page.locator('link[href*="cdn.jsdelivr.net"], script[src*="cdn.jsdelivr.net"]')).toHaveCount(0);
  await expect(page.locator('img[src^="https://swimburger.net/content"], link[href^="https://swimburger.net/content"]')).toHaveCount(0);
});

test("evaluates valid and invalid expressions with accessible debounced validation", async ({ page }) => {
  const input = page.locator("#crontab-expression");
  const error = page.locator("#cron-error");
  const occurrences = page.locator(".occurrences-list li");
  const showMore = page.getByRole("button", { name: "Show 10 more" });
  const copyLink = page.getByRole("button", { name: "Copy link" });

  await expect(occurrences).toHaveCount(10);
  await expect(input).toHaveAttribute("aria-describedby", "cron-hint");

  await input.fill("not a cron");
  await expect(error).toBeHidden();
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(error).toContainText("Invalid expression");
  await expect(error).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", "cron-hint cron-error");
  await expect(showMore).toBeDisabled();
  await expect(copyLink).toBeDisabled();

  await input.fill("0 12 * * Mon");
  await expect(page.getByText("classic five-field CRON format")).toBeVisible();
  await expect(occurrences).toHaveCount(10);
  await expect(input).toHaveAttribute("aria-invalid", "false");

  await showMore.click();
  await expect(occurrences).toHaveCount(20);
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 occurrences" })).toBeAttached();
});

test("starts default results from now rather than midnight", async ({ page }) => {
  await page.getByText("Schedule options", { exact: true }).click();
  await page.getByLabel("UTC", { exact: true }).check();
  const before = Date.now();
  await page.locator("#crontab-expression").fill("0 * * * * *");

  const first = page.locator(".occurrences-list li").first();
  await expect(page.locator("#schedule-summary")).toContainText("second = 0; minute = *");
  await expect(first).toContainText("UTC");
  const timestamp = `${await first.locator(".occurrence-time").innerText()}Z`.replace(" ", "T");
  const occurrence = Date.parse(timestamp);

  expect(occurrence).toBeGreaterThanOrEqual(before);
  expect(occurrence).toBeLessThanOrEqual(Date.now() + 61_000);
  await expect(page.locator(".occurrence-past")).toHaveCount(0);
});

test("normalizes arbitrary whitespace including tabs", async ({ page }) => {
  const input = page.locator("#crontab-expression");
  await input.fill("0\t0\t12\t*\t*\t*");

  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#schedule-summary")).toContainText("6-field schedule");
  await expect(page.locator(".occurrences-list li")).toHaveCount(10);
});

test("offers presets, field guidance, a reliable summary, and semantic headings", async ({ page }) => {
  await expect(page.locator("#cron-hint")).toContainText("second minute hour day month weekday");
  const options = page.locator("details.schedule-options");
  await expect(options).not.toHaveAttribute("open", "");
  await expect(page.locator("#active-timezone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Five-field: every minute" })).toBeHidden();
  const optionsToggle = page.locator("details.schedule-options > summary");
  await optionsToggle.focus();
  await page.keyboard.press("Enter");
  await expect(options).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Five-field: every minute" }).click();
  await expect(page.locator("#crontab-expression")).toHaveValue("* * * * *");
  await expect(page.locator("#schedule-summary")).toContainText("minute = *; hour = *");
  await expect(page.getByRole("heading", { name: "Next occurrences", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Six-field: daily at noon" }).click();
  await expect(page.locator("#crontab-expression")).toHaveValue("0 0 12 * * *");
  await expect(page.locator("#schedule-summary")).toContainText("hour = 12");
});

test("supports UTC and browser-local start times and DST boundaries", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:8787",
    timezoneId: "America/New_York",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#crontab-expression")).toBeVisible();
  await expect(page.locator("#active-timezone")).toContainText("America/New_York");
  await page.getByText("Schedule options", { exact: true }).click();

  await page.locator("#start-date-time").fill("2027-03-14T00:00");
  await page.locator("#crontab-expression").fill("0 30 2 * * *");
  await expect(page.locator(".occurrences-list li").first()).toContainText(
    "2027-03-15 02:30:00 America/New_York (UTC-04:00)",
  );

  await page.locator("#start-date-time").fill("2027-11-07T00:00");
  await page.locator("#crontab-expression").fill("0 30 1 * * *");
  await expect(page.locator(".occurrences-list li").first()).toContainText(
    "2027-11-07 01:30:00 America/New_York (UTC-04:00 / UTC-05:00)",
  );

  await page.getByLabel("UTC", { exact: true }).check();
  await expect(page.locator("#active-timezone")).toHaveText("Active time zone: UTC");
  await expect(page.locator(".occurrences-list li").first()).toContainText("UTC");
  await context.close();
});

test("does not load advertising or the removed Bootstrap runtime stylesheet", async ({ page }) => {
  await expect(page.locator("[data-ea-publisher]")).toHaveCount(0);
  await expect(page.locator('script[src*="ethicalads"]')).toHaveCount(0);
  await expect(page.locator('link[href*="bootstrap"]')).toHaveCount(0);

  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.some((url) => url.includes("Microsoft.AspNetCore.WebUtilities"))).toBe(false);
});

test("copies all schedule settings in a shareable link and reports success", async ({ page }) => {
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
  await page.getByText("Schedule options", { exact: true }).click();
  await page.getByLabel("UTC", { exact: true }).check();
  await page.locator("#start-date-time").fill("2027-01-02T03:04");

  await page.getByRole("button", { name: "Copy link" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toHaveText("Link copied");
  const copiedLink = await page.evaluate(() => window.copiedLink);
  expect(copiedLink).toContain("expression=0%200%2012%20%2A%20%2A%2F2%20Mon");
  expect(copiedLink).toContain("timezone=utc");
  expect(copiedLink).toContain("start=2027-01-02T03%3A04%3A00");
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

  const copyButton = page.getByRole("button", { name: "Copy link" });
  await copyButton.click();

  await expect(page.getByRole("status").filter({ hasText: "Copy failed" })).toHaveText("Copy failed");
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

  await page.getByText("Schedule options", { exact: true }).click();
  const themeStyles = await page.evaluate(() => {
    const primary = getComputedStyle(document.querySelector(".btn-primary"));
    const badge = getComputedStyle(document.querySelector(".badge"));
    const start = getComputedStyle(document.querySelector("#start-date-time"));
    const radio = getComputedStyle(document.querySelector('input[type="radio"]'));
    const header = getComputedStyle(document.querySelector(".app-header"));
    return {
      primary: [primary.color, primary.backgroundColor],
      badge: [badge.color, badge.backgroundColor],
      startColorScheme: start.colorScheme,
      radioAccent: radio.accentColor,
      headerBackground: header.backgroundImage,
    };
  });
  expect(contrastRatio(...themeStyles.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(...themeStyles.badge)).toBeGreaterThanOrEqual(4.5);
  expect(themeStyles.startColorScheme).toBe("light dark");
  expect(themeStyles.radioAccent).not.toBe("auto");
  expect(themeStyles.headerBackground).not.toContain("247, 120, 186");

  await page.locator("#crontab-expression").fill("not a cron");
  await expect(page.locator("#cron-error")).toBeVisible();
  const validationColors = await page.locator("#cron-error").evaluate((element) => {
    const error = getComputedStyle(element);
    const surface = getComputedStyle(element.closest(".tool-card"));
    return [error.color, surface.backgroundColor];
  });
  expect(contrastRatio(...validationColors)).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeDisabled();

  const document = await (await request.get("/")).text();
  expect(document).not.toContain("googletagmanager.com");
  expect(document).not.toContain("google-analytics.com");
});

test("preserves controls, focus, and boundaries in forced-colors mode", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.reload();
  await page.getByText("Schedule options", { exact: true }).click();

  const preset = page.getByRole("button", { name: "Five-field: every minute" });
  await page.locator("details.schedule-options > summary").focus();
  await page.keyboard.press("Tab");
  await expect(preset).toBeFocused();
  const forcedStyles = await page.evaluate(() => {
    const focused = getComputedStyle(document.activeElement);
    const toolCard = getComputedStyle(document.querySelector(".tool-card"));
    const terminal = getComputedStyle(document.querySelector(".occurrences-list"));
    const footer = getComputedStyle(document.querySelector("footer"));
    return {
      active: matchMedia("(forced-colors: active)").matches,
      focusOutline: focused.outlineStyle,
      cardBorder: toolCard.borderStyle,
      terminalBorder: terminal.borderStyle,
      footerBorder: footer.borderTopStyle,
      footerBackground: footer.backgroundImage,
    };
  });

  expect(forcedStyles.active).toBe(true);
  expect(forcedStyles.focusOutline).not.toBe("none");
  expect(forcedStyles.cardBorder).toBe("solid");
  expect(forcedStyles.terminalBorder).toBe("solid");
  expect(forcedStyles.footerBorder).toBe("solid");
  expect(forcedStyles.footerBackground).toBe("none");

  await page.locator("#crontab-expression").fill("invalid");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Copy link" })).toHaveCSS("opacity", "1");
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
