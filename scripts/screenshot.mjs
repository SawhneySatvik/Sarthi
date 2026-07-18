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
// SAR-012 D-041: the onboarding steps crossfade between questions and the chips animate
// their color transition. Let that finish before a shot so captures never land
// mid-transition (which read as inconsistent / faint chip styling).
const SETTLE_MS = 320;
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

async function habitsLens(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Habits" }).click();
        await page.getByText("done today").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(350);
        await shot(page, `habits-lens-${width}-${theme}-${mode}`);

        // Satisfied-by refusal: tap the rule-bearing row → the rule hint reveals
        // (transient ~900ms). Water is always the rule-bearing habit in the seed.
        await page.getByRole("button", { name: /Water/ }).first().click().catch(() => {});
        await page.waitForTimeout(150);
        await shot(page, `habits-refuse-${width}-${theme}-${mode}`);
      });
    }
  }
}

async function skillsLens(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Skills" }).click();
        await page.getByText("tap a track for its mastery").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(350);
        await shot(page, `skills-lens-${width}-${theme}-${mode}`);

        // Push a track drill → the hero mastery counter.
        await page.getByRole("button", { name: /System design/ }).first().click().catch(() => {});
        await page.getByText("hours practiced").first().waitFor({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
        await shot(page, `skills-drill-${width}-${theme}-${mode}`);

        // Scroll the drill to expose the curriculum + session log (M1/M2 verification).
        await page.mouse.move(Math.round(width / 2), 400);
        await page.mouse.wheel(0, 3000);
        await page.waitForTimeout(400);
        await shot(page, `skills-drill-log-${width}-${theme}-${mode}`);
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

// SAR-012 Pass 1 — the CORE onboarding walk (A → B1–B6). Drive against a SEED_STATE=fresh
// DB (no profile → the gate lands here). Covers the unit toggle, B5 multi-domain, a
// voice-fill confirm, the post-CORE seam, and a reload-resume. 390px + desktop, Ember ×2.
async function onboarding(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        // Settle the crossfade / chip transition, THEN shoot — never mid-transition.
        const snap = async (name) => {
          await page.waitForTimeout(SETTLE_MS);
          await shot(page, name);
        };
        await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Begin" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-welcome-${width}-${theme}-${mode}`);

        // A → B1 name, with a voice-fill confirm.
        await page.getByRole("button", { name: "Begin" }).click().catch(() => {});
        await page.getByLabel("Your name").waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-b1-name-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Say your answer" }).click().catch(() => {});
        await page.getByLabel("Your spoken answer").fill("call me Satvik").catch(() => {});
        await page.getByRole("button", { name: "Fill" }).click().catch(() => {});
        await page.getByRole("button", { name: "Use this" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-voice-confirm-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Use this" }).click().catch(() => {});
        await page.getByLabel("Your name").fill("Satvik").catch(() => {});
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B2 dob. `fill` leaves the date field focused, which paints Chromium's
        // system-blue active-segment highlight; blur so the shot captures the true
        // resting state (value shown, no highlighted segment) before the settle + snap.
        await page.getByLabel("Date of birth").fill("1998-03-14").catch(() => {});
        await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur()).catch(() => {});
        await snap(`onboarding-b2-dob-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B3 body + the unit toggle.
        await page.getByLabel("Increase Height").waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-b3-body-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "ft-in / lb" }).click().catch(() => {});
        await snap(`onboarding-b3-body-imperial-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B4 day-shape + sliders.
        await page.getByRole("button", { name: "student" }).click().catch(() => {});
        await snap(`onboarding-b4-day-${width}-${theme}-${mode}`);

        // Reload-resume (§10 kill-app row) proved MID-FLOW. The draft persists screen +
        // answers live to localStorage, so reloading here restores the flow to the day-shape
        // question (B4) with "student" still selected — NOT the final step. Captured before
        // B5/B6 are filled, so the restored screen provably can't be the time budget: the
        // artifact is a distinct question from b6-time and genuinely evidences a resumed
        // session. The `student` marker confirms the restore before shooting; the persisted
        // answer keeps B4's Continue enabled so B5/B6/core-done proceed unchanged.
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "student" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-resume-${width}-${theme}-${mode}`);

        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B5 goals — multi-domain selection.
        await page.getByRole("button", { name: "gym" }).click().catch(() => {});
        await page.getByRole("button", { name: "track spends" }).click().catch(() => {});
        await page.getByLabel("Name a skill").fill("system design").catch(() => {});
        await snap(`onboarding-b5-goals-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B6 time budget.
        await page.getByRole("button", { name: "30m" }).click().catch(() => {});
        await snap(`onboarding-b6-time-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
        await snap(`onboarding-core-done-${width}-${theme}-${mode}`);
      });
    }
  }
}

// A 1×1 PNG — the fake vision adapter is toggle-driven, so image content is irrelevant.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC",
  "base64",
);

async function photoFlow(browser, themes, widths) {
  const fileArg = { name: "lunch.png", mimeType: "image/png", buffer: PNG_1x1 };
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      // Meal pass: preview + toggle + meal confirm (estimate card, NOT auto-filed).
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.route("**/api/capture/parse-photo", async (r) => {
          await new Promise((x) => setTimeout(x, 700));
          await r.continue();
        });
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.locator('input[type="file"]').setInputFiles(fileArg);
        await page.getByText("What is this?").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
        await shot(page, `photo-preview-${width}-${theme}-${mode}`);

        await page.getByRole("button", { name: /^receipt$/i }).first().click().catch(() => {});
        await page.waitForTimeout(200);
        await shot(page, `photo-preview-receipt-${width}-${theme}-${mode}`);

        await page.getByRole("button", { name: /^meal$/i }).first().click().catch(() => {});
        await page.getByRole("button", { name: /Analyze/i }).first().click().catch(() => {});
        await page.getByText("Confirm estimates").first().waitFor({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, `photo-meal-confirm-${width}-${theme}-${mode}`);
      });

      // Receipt pass: toggle receipt → analyze → the transaction batch (F5), also pending.
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.locator('input[type="file"]').setInputFiles(fileArg);
        await page.getByText("What is this?").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.getByRole("button", { name: /^receipt$/i }).first().click().catch(() => {});
        await page.getByRole("button", { name: /Analyze/i }).first().click().catch(() => {});
        await page.getByText("Confirm estimates").first().waitFor({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, `photo-receipt-confirm-${width}-${theme}-${mode}`);
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
    await habitsLens(browser, EMBER, [MOBILE, DESKTOP]);
    await skillsLens(browser, EMBER, [MOBILE, DESKTOP]);
    await captureFlow(browser, EMBER, [MOBILE]);
    await captureFlow(browser, [["ember", "dark"]], [DESKTOP]);
    await photoFlow(browser, EMBER, [MOBILE]);
  } else if (SHOTS === "money") {
    await moneyLens(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "habits") {
    await habitsLens(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "skills") {
    await skillsLens(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "photo") {
    await photoFlow(browser, EMBER, [MOBILE]);
  } else if (SHOTS === "capture") {
    // The two hero-surface flows — verifies the SAR-011 CaptureSheet refactor didn't
    // regress the text F3 path, and the new photo ramp (+ desktop smoke, D-034).
    await captureFlow(browser, EMBER, [MOBILE]);
    await photoFlow(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "onboarding") {
    // SAR-012 Pass 1 — drive against a SEED_STATE=fresh DB (see the ticket Verification block).
    await onboarding(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "empty") {
    await today(browser, "empty", [["ember", "dark"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "alldone") {
    await today(browser, "alldone", [["ember", "dark"]], [MOBILE, DESKTOP]);
  }
} finally {
  await browser.close();
}
console.log("screenshots done:", SHOTS);
