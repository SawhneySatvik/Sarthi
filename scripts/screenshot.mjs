/**
 * scripts/screenshot.mjs — the screenshot-verify harness (D-034 / verify-screen).
 * Launches headless Chromium, sets the theme via localStorage (read by the pre-paint
 * script), drives the real UI, and saves shots to .verify/screens/<name>.png at 390px
 * (the fidelity gate) + desktop. Keyless — runs against `next start` on the fake stack.
 *
 *   BASE_URL=http://localhost:3111 SHOTS=main node scripts/screenshot.mjs
 */
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const OUT = process.env.OUT ?? ".verify/screens";
const SHOTS = process.env.SHOTS ?? "main";
mkdirSync(OUT, { recursive: true });

const MOBILE = 390;
const DESKTOP = 1280;
const EMBER = [["ember", "dark"], ["ember", "light"]];
const NON_EMBER = [["bone", "dark"], ["bone", "light"], ["moss", "dark"], ["moss", "light"]];

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("  shot", name);
}

async function withPage(browser, { theme, mode, width }, fn) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(
    ([t, m]) => {
      try {
        localStorage.setItem("sarthi-theme", JSON.stringify({ theme: t, mode: m }));
      } catch {}
      // Hide the dev-only theme switcher so the evidence shots are clean chrome.
      const hide = () => {
        const style = document.createElement("style");
        style.textContent = "[data-dev-switcher]{display:none!important}";
        (document.head || document.body || document.documentElement).appendChild(style);
      };
      if (document.head) hide();
      else document.addEventListener("DOMContentLoaded", hide);
    },
    [theme, mode],
  );
  const page = await context.newPage();
  try {
    await fn(page);
  } catch (error) {
    console.log(`  ! ${theme}/${mode}/${width}:`, error.message);
  }
  await context.close();
}

async function today(browser, label, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.waitForTimeout(350);
        await shot(page, `today-${label}-${width}-${theme}-${mode}`);
      });
    }
  }
}

async function healthLens(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Health" }).click();
        await page.waitForTimeout(450);
        await shot(page, `health-lens-${width}-${theme}-${mode}`);
      });
    }
  }
}

async function moneyLens(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Money" }).click();
        // Gate the shot on the lens actually being mounted (not the placeholder).
        await page.getByText("Safe to spend").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
        await shot(page, `money-lens-${width}-${theme}-${mode}`);

        // Scroll the ledger clear of the fixed capture bar (F1 proof).
        await page.mouse.move(Math.round(width / 2), 400);
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(450);
        await shot(page, `money-ledger-${width}-${theme}-${mode}`);
        await page.mouse.wheel(0, -4000);
        await page.waitForTimeout(250);

        // Safe-to-spend glass-box math sheet — gate on the math rows appearing.
        await page.getByRole("button", { name: /Safe to spend/ }).first().click().catch(() => {});
        await page.getByText("Balance so far").first().waitFor({ timeout: 3000 }).catch(() => {});
        await shot(page, `money-math-${width}-${theme}-${mode}`);

        // Category drill (tap a budget bar → push) — gate on the Back affordance.
        await page.getByRole("button", { name: /Food/ }).first().click().catch(() => {});
        await page.getByText("Back").first().waitFor({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
        await shot(page, `money-drill-${width}-${theme}-${mode}`);
      });
    }
  }
}

async function captureFlow(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        // Delay the parse so the shimmer state is capturable.
        await page.route("**/api/capture/parse", async (route) => {
          await new Promise((r) => setTimeout(r, 900));
          await route.continue();
        });
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });

        const input = page.getByLabel("Capture your day");
        await input.fill("Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design");
        await shot(page, `capture-input-${width}-${theme}-${mode}`);

        await input.press("Enter");
        await page.waitForSelector("text=Reading your day", { timeout: 2500 }).catch(() => {});
        await shot(page, `capture-shimmer-${width}-${theme}-${mode}`);

        await page.waitForSelector("text=Confirm estimates", { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(450);
        await shot(page, `capture-confirm-${width}-${theme}-${mode}`);

        // Why-flip on the top card, then flip back.
        await page.getByRole("button", { name: "why?" }).first().click().catch(() => {});
        await page.waitForTimeout(300);
        await shot(page, `capture-why-${width}-${theme}-${mode}`);
        await page.getByText("tap to flip back").click().catch(() => {});
        await page.waitForTimeout(200);

        // Edit-in-place on the top card (meal), then toggle off.
        await page.getByRole("button", { name: "Edit" }).first().click().catch(() => {});
        await page.waitForTimeout(250);
        await shot(page, `capture-edit-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Editing" }).first().click().catch(() => {});
        await page.waitForTimeout(150);

        // Reach the done/fan-out state: accept the first resolvable card, discard the rest.
        await page.getByRole("button", { name: /^Accept$/ }).first().click().catch(() => {});
        await page.waitForTimeout(650);
        for (let i = 0; i < 4; i++) {
          const discard = page.getByRole("button", { name: "Discard" }).first();
          if ((await discard.count()) === 0) break;
          await discard.click().catch(() => {});
          await page.waitForTimeout(300);
        }
        await page.waitForTimeout(500);
        await shot(page, `capture-done-${width}-${theme}-${mode}`);
      });
    }
  }
}

const browser = await chromium.launch({ headless: true });
try {
  if (SHOTS === "main") {
    await today(browser, "populated", EMBER, [MOBILE, DESKTOP]);
    await today(browser, "sweep", NON_EMBER, [MOBILE]); // ember covered by 'populated' → full 6-mode set
    // Health BEFORE the capture flow, so its rows show the clean seed (the flow commits meals).
    await healthLens(browser, [["ember", "dark"], ["ember", "light"], ["bone", "dark"], ["moss", "dark"]], [MOBILE, DESKTOP]);
    await moneyLens(browser, EMBER, [MOBILE, DESKTOP]); // Money before captureFlow (read-only; keeps the seed clean)
    await captureFlow(browser, EMBER, [MOBILE]);
    await captureFlow(browser, [["ember", "dark"]], [DESKTOP]);
  } else if (SHOTS === "money") {
    await moneyLens(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "empty") {
    await today(browser, "empty", [["ember", "dark"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "alldone") {
    await today(browser, "alldone", [["ember", "dark"]], [MOBILE, DESKTOP]);
  }
} finally {
  await browser.close();
}
console.log("screenshots done:", SHOTS);
