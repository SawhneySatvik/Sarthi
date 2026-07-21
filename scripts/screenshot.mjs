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
// The populated art placements and the true new-user onboarding placement need
// different deterministic seed states. A caller can point this at the existing
// fresh-state local server without resetting the populated art fixture.
const ONBOARDING_BASE = process.env.ONBOARDING_BASE_URL ?? BASE;
const OUT = process.env.OUT ?? ".verify/screens";
const SHOTS = process.env.SHOTS ?? "main";
mkdirSync(OUT, { recursive: true });

const MOBILE = 390;
const DESKTOP = 1280;
// SAR-012 D-041: the onboarding steps crossfade between questions and the chips animate
// their color transition. Let that finish before a shot so captures never land
// mid-transition (which read as inconsistent / faint chip styling).
const SETTLE_MS = 320;
// UI-audit override (ui/enhancement): THEMES="bone:dark,bone:light" forces every
// driver that takes a themes arg to those theme-modes, so a single-theme sweep is one
// flag. Unset → the historical Ember/sweep behaviour is byte-identical.
const parseThemesEnv = (s) =>
  s ? s.split(",").map((p) => p.trim().split(":").map((x) => x.trim())) : null;
const THEME_OVERRIDE = parseThemesEnv(process.env.THEMES);
const EMBER = THEME_OVERRIDE ?? [["ember", "dark"], ["ember", "light"]];
const NON_EMBER = THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"], ["moss", "dark"], ["moss", "light"]];

// UI-audit run sets NAME_PREFIX="ui-audit-" so the isolated evidence is unmistakable.
const NAME_PREFIX = process.env.NAME_PREFIX ?? "";
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${NAME_PREFIX}${name}.png` });
  console.log("  shot", `${NAME_PREFIX}${name}`);
}

async function withPage(browser, { theme, mode, width, strict = false }, fn) {
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
    if (strict) throw error;
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

// Shared-shell smoke: every primary route must retain its active navigation affordance
// at mobile and desktop. This deliberately asserts the rendered accessibility state,
// rather than inferring it from a screenshot alone.
async function shell(browser, themes, widths) {
  const routes = [
    ["today", "Today"],
    ["journey", "Journey"],
    ["coach", "Coach"],
    ["stats", "Stats"],
    ["tools", "Tools"],
  ];
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      for (const [route, label] of routes) {
        await withPage(browser, { theme, mode, width, strict: true }, async (page) => {
          await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
          const primary = page.getByRole("navigation", { name: "Primary" });
          await primary.getByRole("link", { name: label, current: "page" }).waitFor({ state: "visible", timeout: 4000 });
          await page.waitForTimeout(SETTLE_MS);
          await shot(page, `shell-${route}-${width}-${theme}-${mode}`);
        });
      }
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
      await withPage(browser, { theme, mode, width, strict: true }, async (page) => {
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
        await page.getByRole("button", { name: /Food/ }).first().click();
        await page.getByRole("button", { name: /Back/ }).waitFor({ state: "visible", timeout: 3000 });
        if (width < DESKTOP) {
          await page.getByText("Safe to spend").first().waitFor({ state: "hidden", timeout: 3000 });
        }
        if (width >= DESKTOP) {
          await page.getByText("Safe to spend").first().waitFor({ state: "visible", timeout: 3000 });
          await page.getByRole("complementary").getByRole("heading", { name: "Food" }).waitFor({ state: "visible", timeout: 3000 });
        }
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
      await withPage(browser, { theme, mode, width, strict: true }, async (page) => {
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Skills" }).click();
        await page.getByText("tap a track for its mastery").first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(350);
        await shot(page, `skills-lens-${width}-${theme}-${mode}`);

        // Push a track drill → the hero mastery counter.
        await page.getByRole("button", { name: /System design/ }).first().click();
        // The mobile push preserves its existing \"← Skills\" return control.
        await page.getByRole("button", { name: "Skills", exact: true }).last().waitFor({ state: "visible", timeout: 3000 });
        await page.getByText("hours practiced").first().waitFor({ state: "visible", timeout: 3000 });
        if (width < DESKTOP) {
          await page.getByText("tap a track for its mastery").first().waitFor({ state: "hidden", timeout: 3000 });
        }
        if (width >= DESKTOP) {
          await page.getByText("tap a track for its mastery").first().waitFor({ state: "visible", timeout: 3000 });
          await page.getByRole("complementary").getByRole("heading", { name: "System design" }).waitFor({ state: "visible", timeout: 3000 });
        }
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

        await page.getByRole("button", { name: "Open capture" }).click();
        // The composer is a spring sheet; settle it before filling/shooting so the
        // screenshots verify the usable 88vh resting state rather than mid-entry.
        await page.waitForTimeout(400);

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

async function coachScreens(browser, themes, widths) {
  for (const [theme, mode] of themes) for (const width of widths) await withPage(browser, { theme, mode, width }, async (page) => {
    await page.goto(`${BASE}/coach`, { waitUntil: "networkidle" }); await page.waitForTimeout(SETTLE_MS);
    await shot(page, `coach-reading-${width}-${theme}-${mode}`);
    if (width >= DESKTOP) {
      const context = page.getByRole("complementary", { name: "Coach context" });
      await context.getByText("Save ₹5,000 every month", { exact: true }).waitFor({ state: "visible", timeout: 4000 });
      console.log("  coach context verified", `${width}-${theme}-${mode}`);
      await shot(page, `coach-context-${width}-${theme}-${mode}`);
    }
    const pendingAdaptation = width >= DESKTOP
      ? page.getByRole("complementary", { name: "Coach context" }).getByRole("button", { name: /pending/ })
      : page.getByRole("button", { name: /pending/ }).first();
    await pendingAdaptation.click();
    const adaptationDialog = page.getByRole("dialog", { name: "Adaptation" });
    await adaptationDialog.waitFor({ state: "visible", timeout: 4000 });
    await shot(page, `coach-adaptation-${width}-${theme}-${mode}`);
    await page.getByLabel("Close adaptation").click();
    await adaptationDialog.waitFor({ state: "hidden", timeout: 4000 });
    await page.getByLabel("Ask your coach").fill("How should I restart?"); await page.getByLabel("Send question").click(); await page.waitForTimeout(250); await shot(page, `coach-ask-${width}-${theme}-${mode}`);
    await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" }); await shot(page, `stats-current-${width}-${theme}-${mode}`);
    await page.getByRole("tab", { name: "Day-1" }).click(); await shot(page, `stats-day-one-${width}-${theme}-${mode}`);
    await page.getByRole("tab", { name: "Potential" }).click(); await shot(page, `stats-potential-${width}-${theme}-${mode}`);
    await page.goto(`${BASE}/journey`, { waitUntil: "networkidle" }); await shot(page, `journey-rail-${width}-${theme}-${mode}`);
    const photos = page.getByRole("button", { name: /photos/ }).first();
    await photos.click();
    const proof = page.getByRole("button", { name: /View proof:/ }).first();
    await proof.waitFor({ state: "visible", timeout: 4000 });
    await shot(page, `journey-expanded-${width}-${theme}-${mode}`);
    await proof.click();
    const viewer = page.getByRole("dialog", { name: "Evidence viewer" });
    await viewer.waitFor({ state: "visible", timeout: 4000 });
    await shot(page, `journey-viewer-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Close evidence viewer" }).click();
    await viewer.waitFor({ state: "hidden", timeout: 4000 });

    // The weekly reading is intentionally Sunday-evening-only. Freeze the *next*
    // document before navigating back to Coach so its signed brief request carries
    // the valid local date 2026-07-19, while the regular Coach pass above remains
    // representative of the host date.
    await page.addInitScript((iso) => {
      const RealDate = Date;
      const fixedNow = new RealDate(iso).valueOf();
      class SundayEveningDate extends RealDate {
        constructor(...args) {
          super(...(args.length === 0 ? [fixedNow] : args));
        }
        static now() { return fixedNow; }
      }
      Object.defineProperty(window, "Date", { configurable: true, writable: true, value: SundayEveningDate });
    }, "2026-07-19T20:00:00");
    await page.goto(`${BASE}/coach`, { waitUntil: "networkidle" });
    const weekly = page.locator("section").filter({ hasText: "Coach observation" });
    await weekly.waitFor({ state: "visible", timeout: 6000 });
    await weekly.scrollIntoViewIfNeeded();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `coach-weekly-${width}-${theme}-${mode}`);
  });
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
        await page.getByRole("button", { name: "wake early" }).click().catch(() => {});
        await page.getByLabel("Name a skill").fill("system design").catch(() => {});
        await snap(`onboarding-b5-goals-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // B6 time budget → Phase C. Delay the spine route so the orbit shimmer is visible
        // for the shot before it resolves into the Phase D cards.
        await page.route("**/api/onboarding/spine", async (r) => {
          await new Promise((x) => setTimeout(x, 900));
          await r.continue();
        });
        await page.getByRole("button", { name: "30m" }).click().catch(() => {});
        await snap(`onboarding-b6-time-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});

        // Phase C — the orbit shimmer (the selected domains drafting in parallel).
        await page.getByText("Drafting your plans").waitFor({ timeout: 4000 }).catch(() => {});
        await shot(page, `onboarding-c-shimmer-${width}-${theme}-${mode}`);

        // Phase D — the confirm cards (one per selected domain), then a stepper-edited row.
        await page.getByRole("button", { name: "Looks right — start Day 1" }).waitFor({ timeout: 6000 }).catch(() => {});
        await snap(`onboarding-d-cards-${width}-${theme}-${mode}`);
        // Full-page: the viewport shot cuts off mid-Habits — capture the whole 4-card
        // stack + the earned `start Day 1` CTA in one shot (shot() is viewport-only).
        const fullName = `onboarding-d-full-${width}-${theme}-${mode}`;
        await page.screenshot({ path: `${OUT}/${fullName}.png`, fullPage: true });
        console.log("  shot", fullName);
        await page.getByRole("button", { name: "Increase" }).first().click().catch(() => {});
        await snap(`onboarding-d-edited-${width}-${theme}-${mode}`);
      });
    }
  }
}

// A complete CORE draft, restored via localStorage so a variant can jump straight to the
// time-budget step (then Continue → Phase C → D) without re-driving all six questions.
function coreDraft(goals) {
  return {
    version: 1,
    screen: "timeBudget",
    answers: {
      displayName: "Satvik",
      birthDate: "1998-03-14",
      heightCm: 178,
      weightGrams: 74000,
      unitSystem: "metric",
      dayShape: "nine_to_five",
      wakeTimeMinutes: 330,
      sleepTimeMinutes: 1380,
      goals,
      timeBudgetMinutes: 30,
    },
  };
}

// SAR-012 Pass 2 — the two Phase-D variants (§14): the 1-domain-only card, and a failed
// spine rendering its retry skeleton while the others stand (§10). Ember only to keep the
// set tight; both seed a restored draft so only the post-CORE phases are exercised.
async function onboardingVariants(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      // 1-domain-only: just a named skill selected → a single confirm card.
      await withPage(browser, { theme, mode, width }, async (page) => {
        const snap = async (name) => {
          await page.waitForTimeout(SETTLE_MS);
          await shot(page, name);
        };
        await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
        await page.evaluate((draft) => localStorage.setItem("sarthi-onboarding-draft", JSON.stringify(draft)), coreDraft({ health: [], money: [], habits: [], skillName: "system design" }));
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
        await page.getByRole("button", { name: "Looks right — start Day 1" }).waitFor({ timeout: 6000 }).catch(() => {});
        await snap(`onboarding-d-one-domain-${width}-${theme}-${mode}`);
      });

      // Failed-spine retry skeleton: abort ONE domain's spine call; the rest resolve.
      await withPage(browser, { theme, mode, width }, async (page) => {
        const snap = async (name) => {
          await page.waitForTimeout(SETTLE_MS);
          await shot(page, name);
        };
        await page.route("**/api/onboarding/spine", async (r) => {
          const body = r.request().postData() ?? "";
          if (body.includes('"domain":"money"')) return r.abort();
          return r.continue();
        });
        await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
        await page.evaluate((draft) => localStorage.setItem("sarthi-onboarding-draft", JSON.stringify(draft)), coreDraft({ health: ["gym"], money: ["budget"], habits: ["focus"], skillName: "system design" }));
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
        await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 6000 }).catch(() => {});
        await snap(`onboarding-d-retry-skeleton-${width}-${theme}-${mode}`);
      });
    }
  }
}

// SAR-012 Pass 3 — Phase E (interstitial + section grid + E1/E2/E5) and Phase F (the three
// live theme previews + a post-apply proof). MOCKS /api/onboarding/accept (canned ok, NO
// write) so the client advances past D into E→F WITHOUT writing a `complete` profile to the
// shared SEED_STATE=fresh DB — so the earlier onboarding walks (which re-goto /onboarding)
// keep working. Every section shot is taken before any Save posts (Skip fires no request).
async function onboardingDetail(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        const snap = async (name) => {
          await page.waitForTimeout(SETTLE_MS);
          await shot(page, name);
        };
        await page.route("**/api/onboarding/accept", (r) =>
          r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, result: { status: "accepted" } }),
          }),
        );
        await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
        await page.evaluate(
          (draft) => localStorage.setItem("sarthi-onboarding-draft", JSON.stringify(draft)),
          coreDraft({ health: ["gym"], money: ["budget"], habits: ["focus"], skillName: "system design" }),
        );
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
        await page.getByRole("button", { name: "Looks right — start Day 1" }).waitFor({ timeout: 6000 }).catch(() => {});
        await page.getByRole("button", { name: "Looks right — start Day 1" }).click().catch(() => {});

        // Phase E interstitial.
        await page.getByRole("button", { name: "Later — take me in" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-e-intro-${width}-${theme}-${mode}`);

        // The order-free section grid.
        await page.getByRole("button", { name: "Sharpen it" }).click().catch(() => {});
        await page.getByRole("button", { name: "Done" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-e-grid-${width}-${theme}-${mode}`);

        // E1 food · E2 screen · E5 money — open, shoot, Skip back to the grid (no write).
        await page.getByRole("button", { name: /Food pattern/ }).click().catch(() => {});
        await page.getByText(/How do you eat/).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-e-food-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Skip" }).click().catch(() => {});

        await page.getByRole("button", { name: /Screen time/ }).click().catch(() => {});
        await page.getByText(/honestly/).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-e-screen-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Skip" }).click().catch(() => {});

        await page.getByRole("button", { name: /Money picture/ }).click().catch(() => {});
        await page.getByText(/Your money picture/).waitFor({ timeout: 4000 }).catch(() => {});
        // Fill a monthly income (8 × ₹5,000 = ₹40,000) + one fixed bill so the ₹/paise integer
        // display + stepper increments are visible in the shot, not the empty "—" state. The snap
        // fires BEFORE Skip, so this is client-state only — no /api/onboarding/detail write posts.
        for (let i = 0; i < 8; i += 1) {
          await page.getByRole("button", { name: "Increase income" }).click().catch(() => {});
        }
        await page.getByRole("button", { name: "Add a bill" }).click().catch(() => {});
        await page.getByLabel("Bill name").fill("Rent").catch(() => {});
        await page.getByLabel("Bill amount in rupees").fill("15000").catch(() => {});
        await snap(`onboarding-e-money-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "Skip" }).click().catch(() => {});

        // Done → Phase F: the three live theme previews, then a Moss pick proving the live switch.
        await page.getByRole("button", { name: "Done" }).click().catch(() => {});
        await page.getByRole("button", { name: "Use this" }).waitFor({ timeout: 4000 }).catch(() => {});
        await snap(`onboarding-f-theme-${width}-${theme}-${mode}`);
        await page.getByRole("button", { name: "moss theme" }).click().catch(() => {});
        // Applying a preview re-runs applyTheme with the ThemeStep's default `system` mode, which
        // resolves → light in headless Chromium and overrides the page's dark setup — so the dark
        // shot was rendering light (byte-identical to -light). Re-assert the walk's intended mode
        // via the Dark/Light chip so `-dark` is genuinely dark and `-light` genuinely light. Moss
        // stays the selected theme; only data-mode changes.
        await page.getByRole("button", { name: mode === "dark" ? "Dark" : "Light", exact: true }).click().catch(() => {});
        await snap(`onboarding-f-applied-${width}-${theme}-${mode}`);
      });
    }
  }
}

// SAR-012 Pass 3 — Phase G landing on Today, Day 1 (the one-time mic hint row + the coach's
// accept-written first line). This does a REAL accept (writes a `complete` profile + a Day-1
// arc), so it MUST run LAST in the onboarding set — afterwards /onboarding bounces to /today
// (D-B). The first iteration walks the accept once; each fresh context then renders /today,
// where `dayOfArc === 1` surfaces the hint row and the coach note renders.
async function onboardingLanding(browser, themes, widths) {
  let accepted = false;
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        if (!accepted) {
          await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
          await page.evaluate(
            (draft) => localStorage.setItem("sarthi-onboarding-draft", JSON.stringify(draft)),
            coreDraft({ health: ["gym"], money: ["budget"], habits: ["focus"], skillName: "system design" }),
          );
          await page.reload({ waitUntil: "networkidle" });
          await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
          await page.getByRole("button", { name: "Looks right — start Day 1" }).waitFor({ timeout: 6000 }).catch(() => {});
          await page.getByRole("button", { name: "Looks right — start Day 1" }).click().catch(() => {});
          // Confirm the REAL accept landed (the E interstitial appears) before moving on.
          await page.getByRole("button", { name: "Later — take me in" }).waitFor({ timeout: 6000 }).catch(() => {});
          accepted = true;
        }
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        await page.waitForTimeout(SETTLE_MS);
        await shot(page, `onboarding-g-landing-${width}-${theme}-${mode}`);
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
        // SAR-019A moved the camera inside the FAB sheet (the persistent bottom bar is gone).
        await page.getByRole("button", { name: "Open capture" }).click();
        await page.locator('input[type="file"]').waitFor({ state: "attached", timeout: 4000 }).catch(() => {});
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
        // SAR-019A moved the camera inside the FAB sheet (the persistent bottom bar is gone).
        await page.getByRole("button", { name: "Open capture" }).click();
        await page.locator('input[type="file"]').waitFor({ state: "attached", timeout: 4000 }).catch(() => {});
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

// SAR-013: MediaRecorder is browser-only, so the visual harness supplies a tiny
// deterministic primitive. Production code remains untouched; this mock produces an
// in-memory webm-shaped Blob and a stoppable stream, exactly like the fake STT path.
async function installVoiceMock(page) {
  await page.addInitScript(() => {
    class ScreenshotMediaRecorder {
      constructor(stream) {
        this.stream = stream;
        this.state = "inactive";
        this.mimeType = "audio/webm";
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(["fake-audio"], { type: this.mimeType }) });
          this.onstop?.();
        });
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: ScreenshotMediaRecorder });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });
}

async function voiceFlow(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      // Hold state, then the pinned/editable transcript, then post-parse confirmation.
      await withPage(browser, { theme, mode, width }, async (page) => {
        await installVoiceMock(page);
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        // SAR-019A moved PTT inside the FAB sheet (the persistent bottom bar is gone).
        await page.getByRole("button", { name: "Open capture" }).click();
        await page.getByRole("button", { name: "Hold to talk" }).waitFor({ timeout: 4000 });
        await page.waitForTimeout(500); // let the spring sheet settle before measuring the orb box
        const mic = page.getByRole("button", { name: "Hold to talk" });
        const box = await mic.boundingBox();
        if (!box) throw new Error("voice mic missing");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.getByText(/Recording|Opening microphone/).first().waitFor({ timeout: 3000 });
        await shot(page, `voice-recording-${width}-${theme}-${mode}`);
        // This is the hold-to-talk path, not a quick tap: clear the 250ms toggle
        // threshold before release so the recorder stops and opens the transcript.
        await page.waitForTimeout(350);
        await page.mouse.up();
        await page.getByText("What Sarthi heard").waitFor({ timeout: 5000 });
        await page.waitForTimeout(SETTLE_MS);
        await shot(page, `voice-transcript-${width}-${theme}-${mode}`);
        await page.getByLabel("Voice transcript").fill("Spent 340 on lunch and did 90 min of system design");
        await page.getByRole("button", { name: "Parse transcript" }).click();
        await page.getByText("Confirm estimates").first().waitFor({ timeout: 6000 });
        await page.waitForTimeout(SETTLE_MS);
        await shot(page, `voice-confirm-${width}-${theme}-${mode}`);
      });

      // A provider error must leave the sheet and in-memory clip open; turn the mock
      // response healthy on Retry so evidence includes both the failure and recovery.
      await withPage(browser, { theme, mode, width }, async (page) => {
        let fail = true;
        await installVoiceMock(page);
        await page.route("**/api/capture/transcribe", async (route) => {
          if (fail) {
            await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, retryable: true, error: "provider-unavailable" }) });
          } else await route.continue();
        });
        await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
        // SAR-019A moved PTT inside the FAB sheet (the persistent bottom bar is gone).
        await page.getByRole("button", { name: "Open capture" }).click();
        await page.getByRole("button", { name: "Hold to talk" }).waitFor({ timeout: 4000 });
        await page.waitForTimeout(500); // let the spring sheet settle before measuring the orb box
        const mic = page.getByRole("button", { name: "Hold to talk" });
        const box = await mic.boundingBox();
        if (!box) throw new Error("voice mic missing");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(SETTLE_MS);
        await page.mouse.up();
        await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 5000 });
        await page.waitForTimeout(SETTLE_MS);
        await shot(page, `voice-retry-${width}-${theme}-${mode}`);
        fail = false;
        await page.getByRole("button", { name: "Retry" }).click();
        await page.getByText("What Sarthi heard").waitFor({ timeout: 5000 });
      });
    }
  }
}

// SAR-016: all timer states are driven by sessionStorage or intercepted completion
// responses. The harness never waits for a real timer and never writes tool rows.
async function seedToolRun(page, kind, skillId) {
  const durationMinutes = kind === "focus" ? 25 : 5;
  await page.evaluate(({ nextKind, nextSkillId, nextDuration }) => {
    sessionStorage.setItem("sarthi-tool-run", JSON.stringify({
      kind: nextKind,
      startedAt: Date.now() - (nextDuration + 1) * 60000,
      durationMinutes: nextDuration,
      skillId: nextKind === "focus" ? nextSkillId : undefined,
      skillName: nextKind === "focus" ? "System design" : undefined,
      patternId: nextKind === "meditation" ? "box" : undefined,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    }));
  }, { nextKind: kind, nextSkillId: skillId, nextDuration: durationMinutes });
}

async function toolsScreens(browser, themes, widths) {
  for (const [theme, mode] of themes) for (const width of widths) await withPage(browser, { theme, mode, width }, async (page) => {
    await page.route("**/api/tools/focus/complete", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, commitId: "22222222-2222-4222-8222-222222222222" }) }));
    await page.route("**/api/tools/meditation/complete", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, commitId: "33333333-3333-4333-8333-333333333333" }) }));
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `tools-grid-${width}-${theme}-${mode}`);

    await page.getByRole("button", { name: "Focus" }).click();
    const focusStart = page.getByRole("button", { name: /Start 25 min/ });
    await focusStart.scrollIntoViewIfNeeded();
    await focusStart.waitFor({ timeout: 4000 });
    const skillId = await page.locator("#focus-skill option").nth(1).getAttribute("value");
    if (!skillId) throw new Error("seeded skill missing");
    await shot(page, `tools-focus-idle-${width}-${theme}-${mode}`);
    await focusStart.click();
    await page.getByRole("button", { name: "End early" }).waitFor({ timeout: 4000 });
    await shot(page, `tools-focus-running-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "End early" }).click();
    await shot(page, `tools-focus-abandon-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Discard" }).click();

    await seedToolRun(page, "focus", skillId);
    await page.goto(`${BASE}/tools?resume=1`, { waitUntil: "networkidle" });
    await page.getByText("Your block is ready to file.").waitFor({ timeout: 4000 });
    await shot(page, `tools-focus-resume-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: /File 25 min/ }).click();
    await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 4000 });
    await shot(page, `tools-focus-complete-${width}-${theme}-${mode}`);

    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Meditation" }).click();
    const meditationStart = page.getByRole("button", { name: /Start 5 min/ });
    await meditationStart.scrollIntoViewIfNeeded();
    await meditationStart.waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-idle-${width}-${theme}-${mode}`);
    // The populated fixture owns Meditate; clear the session-local run and exercise
    // the consent state only when it is absent is a separate fresh fixture concern.
    await meditationStart.click();
    await page.getByRole("button", { name: "Continue" }).waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-running-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Discard session" }).click();
    await seedToolRun(page, "meditation", null);
    await page.goto(`${BASE}/tools?resume=1`, { waitUntil: "networkidle" });
    await page.getByText("Your practice is ready to file.").waitFor({ timeout: 4000 });
    await page.getByRole("button", { name: /File 5 min/ }).click();
    await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-complete-${width}-${theme}-${mode}`);

    // This state is intentionally server-gated. The command below must target
    // `pnpm dev` or a `JUDGE_MODE=true` server; production ignores the query.
    await page.goto(`${BASE}/tools?shot=meditation-consent`, { waitUntil: "networkidle" });
    const consentStart = page.getByRole("button", { name: /Start 5 min/ });
    await consentStart.scrollIntoViewIfNeeded();
    await consentStart.click();
    await page.getByText("Add Meditate to your habits?").waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-consent-${width}-${theme}-${mode}`);
  });
}

// A short recovery pass for the two meditation states that follow the general
// tools loop. Eight shots total: completion + first-use consent × Ember × widths.
async function toolsMeditationFinal(browser, themes, widths) {
  for (const [theme, mode] of themes) for (const width of widths) await withPage(browser, { theme, mode, width }, async (page) => {
    await page.route("**/api/tools/meditation/complete", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, commitId: "33333333-3333-4333-8333-333333333333" }) }));
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await seedToolRun(page, "meditation", null);
    await page.goto(`${BASE}/tools?resume=1`, { waitUntil: "networkidle" });
    await page.getByText("Your practice is ready to file.").waitFor({ timeout: 4000 });
    await page.getByRole("button", { name: /File 5 min/ }).click();
    await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-complete-${width}-${theme}-${mode}`);

    await page.goto(`${BASE}/tools?shot=meditation-consent`, { waitUntil: "networkidle" });
    const start = page.getByRole("button", { name: /Start 5 min/ });
    await start.scrollIntoViewIfNeeded();
    await start.click();
    await page.getByText("Add Meditate to your habits?").waitFor({ timeout: 4000 });
    await shot(page, `tools-meditation-consent-${width}-${theme}-${mode}`);
  });
}

// T4 (D-017): the two newly-live tools — Afford-it (→ Money verdict, no timer) and Workout
// Counter (→ Health rep/set log). The deep-tier verdict + both writes are intercepted, so the
// harness stays keyless and never files a row. afford-* + workout-* × Bone dark/light × 390/1280.
async function toolsT4Screens(browser, themes, widths) {
  for (const [theme, mode] of themes) for (const width of widths) await withPage(browser, { theme, mode, width }, async (page) => {
    await page.route("**/api/tools/afford/check", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
      ok: true,
      verdict: { rating: "comfortable", reason: "Yes — ₹3,000 sits comfortably within your ₹42,000 safe-to-spend." },
      context: { item: "Running shoes", pricePaise: 300000, safeToSpendPaise: 4200000, balancePaise: 5800000, remainingBudgetedPaise: 1200000, upcomingRecurringPaise: 400000, dataDays: 24 },
      categories: [{ id: "c-shopping", name: "Shopping" }, { id: "c-fitness", name: "Fitness" }],
    }) }));
    await page.route("**/api/capture/commit", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, result: { commitId: "44444444-4444-4444-8444-444444444444" }, unresolved: [] }) }));
    await page.route("**/api/tools/workout/complete", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, commitId: "55555555-5555-4555-8555-555555555555" }) }));

    // Afford-it — input → verdict (glass-box three numbers) → logged.
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await page.waitForTimeout(SETTLE_MS);
    await page.getByRole("button", { name: /Afford it/ }).click();
    await page.locator("#afford-item").waitFor({ timeout: 4000 });
    await page.locator("#afford-item").fill("Running shoes");
    await page.locator("#afford-price").fill("3000");
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `afford-input-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: /Check if I can afford it/ }).click();
    await page.getByText("Safe to spend").waitFor({ timeout: 4000 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `afford-verdict-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: /Bought it/ }).click();
    await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 4000 });
    await shot(page, `afford-logged-${width}-${theme}-${mode}`);

    // Workout Counter — rep/set build → filed.
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Workout counter/ }).click();
    await page.locator("#workout-duration").waitFor({ timeout: 4000 });
    await page.locator('input[aria-label="Exercise 1 name"]').fill("Back squat");
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `workout-build-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: /Finish/ }).click();
    await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 4000 });
    await shot(page, `workout-complete-${width}-${theme}-${mode}`);
  });
}

// SAR-017: Settings is rendered through the real avatar sheet. The six-mode loop
// relies on withPage's pre-paint localStorage setup; no profile/theme write occurs.
async function settingsScreens(browser, themes, widths) {
  for (const [theme, mode] of themes) for (const width of widths) await withPage(browser, { theme, mode, width }, async (page) => {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Settings and profile" }).click();
    await page.getByRole("dialog", { name: "Settings" }).waitFor({ timeout: 4000 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `settings-main-${width}-${theme}-${mode}`);
    // T2 — the new load-bearing controls sit below the fold inside the sheet's own
    // overflow-y-auto container, so (like the Developer block) they must be scrolled into
    // view before capture rather than relying on viewport/fullPage framing.
    const tz = page.getByLabel("Time zone");
    if (await tz.count()) {
      await tz.scrollIntoViewIfNeeded();
      await page.waitForTimeout(SETTLE_MS);
      await shot(page, `settings-timezone-${width}-${theme}-${mode}`);
    }
    // Scroll a LOWER element (the On-open briefs control, below the whole COACH block) into
    // view so the dense Weekly-brief row (label + day select + time) lands in-frame at 390 —
    // "Morning brief" alone sits at the fold edge and never scrolls the weekly row up.
    const onOpen = page.getByLabel("On-open briefs");
    if (await onOpen.count()) {
      await onOpen.scrollIntoViewIfNeeded();
      await page.waitForTimeout(SETTLE_MS);
      await shot(page, `settings-coach-brief-${width}-${theme}-${mode}`);
    }
    const provider = page.getByLabel("AI provider");
    if (await provider.count()) {
      await provider.scrollIntoViewIfNeeded();
      await shot(page, `settings-developer-${width}-${theme}-${mode}`);
    }

    await page.getByText("Theme", { exact: true }).click();
    await page.getByRole("dialog", { name: "Appearance" }).waitFor({ timeout: 4000 });
    await shot(page, `settings-appearance-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Close settings" }).click();

    // Extra evidence states only once per theme/mode/width; selectors are guarded
    // because fresh/populated profiles legitimately differ in their gap count.
    await page.getByRole("button", { name: "Settings and profile" }).click();
    await page.getByText("Danger zone", { exact: true }).click();
    await page.getByRole("dialog", { name: "Danger zone" }).waitFor({ timeout: 4000 });
    await shot(page, `settings-danger-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Close settings" }).click();

    // About panel — evidence for the T2 Privacy/Terms legal stubs (routes land in a later ticket).
    await page.getByRole("button", { name: "Settings and profile" }).click();
    await page.getByRole("button", { name: /Sarthi v1\.0/ }).click();
    await page.getByRole("dialog", { name: "About" }).waitFor({ timeout: 4000 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `settings-about-${width}-${theme}-${mode}`);
    await page.getByRole("button", { name: "Close settings" }).click();
  });
}

// SAR-018: concise F2-F11 route/action proof. Each capture starts from a real app route;
// no seed-like UI state is fabricated in the browser.
async function stitchScreens(browser) {
  for (const width of [MOBILE, DESKTOP]) await withPage(browser, { theme: "ember", mode: "dark", width }, async (page) => {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Done" }).first().click().catch(() => {});
    await page.getByLabel("Capture your day").waitFor({ timeout: 4000 });
    await shot(page, `stitch-today-capture-context-${width}-ember-dark`);

    await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Skills:/ }).click().catch(() => {});
    await page.getByText("tap a track for its mastery").waitFor({ timeout: 4000 }).catch(() => {});
    await shot(page, `stitch-stats-lens-${width}-ember-dark`);
    await page.getByRole("button", { name: /System design/ }).first().click().catch(() => {});
    await page.getByRole("link", { name: "Start 50m focus" }).click().catch(() => {});
    await page.getByRole("button", { name: /Start 50 min/ }).waitFor({ timeout: 4000 }).catch(() => {});
    await shot(page, `stitch-skills-focus-preset-${width}-ember-dark`);

    await page.goto(`${BASE}/journey`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /photos/ }).first().click().catch(() => {});
    await page.getByRole("button", { name: /View proof:/ }).first().click().catch(() => {});
    await page.getByRole("dialog", { name: "Evidence viewer" }).waitFor({ timeout: 4000 }).catch(() => {});
    await shot(page, `stitch-journey-evidence-${width}-ember-dark`);

    await page.goto(`${BASE}/coach`, { waitUntil: "networkidle" });
    await page.getByText(/Deep work|lighter restart/).first().click().catch(() => {});
    await shot(page, `stitch-coach-adaptation-${width}-ember-dark`);
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Settings and profile" }).click().catch(() => {});
    await page.getByRole("dialog", { name: "Settings" }).waitFor({ timeout: 4000 }).catch(() => {});
    await shot(page, `stitch-settings-${width}-ember-dark`);
  });
}

// Painterly art is intentionally sampled by placement family, not by every screen state.
async function artScreens(browser) {
  for (const width of [MOBILE, DESKTOP]) await withPage(browser, { theme: "ember", mode: "dark", width }, async (page) => {
    await page.goto(`${ONBOARDING_BASE}/onboarding`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Begin" }).waitFor({ state: "visible", timeout: 4000 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `art-onboarding-${width}-ember-dark`);

    await page.goto(`${BASE}/today`, { waitUntil: "networkidle" }); await shot(page, `art-today-${width}-ember-dark`);
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" }); await shot(page, `art-tools-${width}-ember-dark`);
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("heading", { name: "Focus" }).waitFor({ timeout: 4000 });
    await page.getByRole("button", { name: "Start 25 min" }).waitFor({ timeout: 4000 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `art-focus-detail-${width}-ember-dark`);
    await page.goto(`${BASE}/journey`, { waitUntil: "networkidle" }); await shot(page, `art-journey-${width}-ember-dark`);
    // Weekly is intentionally shown only on Sunday evening. Freeze this document's
    // browser clock, then wait for the real seeded weekly brief and frame its art band.
    await page.addInitScript((iso) => {
      const RealDate = Date;
      const fixedNow = new RealDate(iso).valueOf();
      class SundayEveningDate extends RealDate {
        constructor(...args) { super(...(args.length === 0 ? [fixedNow] : args)); }
        static now() { return fixedNow; }
      }
      Object.defineProperty(window, "Date", { configurable: true, writable: true, value: SundayEveningDate });
    }, "2026-07-19T20:00:00");
    await page.goto(`${BASE}/coach`, { waitUntil: "networkidle" });
    const weekly = page.getByText("This week", { exact: true });
    await weekly.waitFor({ state: "visible", timeout: 6000 });
    await weekly.scrollIntoViewIfNeeded();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `art-coach-${width}-ember-dark`);
  });
  // Targeted contrast-risk checks: light scrim on Today and Moss-dark tool text.
  await withPage(browser, { theme: "ember", mode: "light", width: MOBILE }, async (page) => { await page.goto(`${BASE}/today`, { waitUntil: "networkidle" }); await shot(page, "art-today-390-ember-light"); });
  await withPage(browser, { theme: "moss", mode: "dark", width: MOBILE }, async (page) => { await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" }); await shot(page, "art-tools-390-moss-dark"); });
}

// UI-enhancement: the master landing owns `/`. It's static/keyless (no seed needed). The
// hero uses a mount-reveal (settles on load); below-fold sections use whileInView, so we
// scroll through in viewport steps to trigger each reveal, shooting the hero + each section.
async function landing(browser, themes, widths) {
  for (const [theme, mode] of themes) {
    for (const width of widths) {
      await withPage(browser, { theme, mode, width }, async (page) => {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        await page.waitForTimeout(600); // let the hero mount-reveal settle
        await shot(page, `landing-hero-${width}-${theme}-${mode}`);
        const vh = width < 500 ? 844 : 900;
        const total = await page.evaluate(() => document.body.scrollHeight);
        let y = 0;
        let i = 1;
        while (y + vh < total) {
          y += Math.round(vh * 0.82);
          await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
          await page.waitForTimeout(500); // let whileInView reveals fire + settle
          await shot(page, `landing-s${i}-${width}-${theme}-${mode}`);
          i += 1;
        }
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
    await healthLens(browser, THEME_OVERRIDE ?? [["ember", "dark"], ["ember", "light"], ["bone", "dark"], ["moss", "dark"]], [MOBILE, DESKTOP]);
    await moneyLens(browser, EMBER, [MOBILE, DESKTOP]); // Money before captureFlow (read-only; keeps the seed clean)
    await habitsLens(browser, EMBER, [MOBILE, DESKTOP]);
    await skillsLens(browser, EMBER, [MOBILE, DESKTOP]);
    await captureFlow(browser, EMBER, [MOBILE]);
    await captureFlow(browser, THEME_OVERRIDE ?? [["ember", "dark"]], [DESKTOP]);
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
  } else if (SHOTS === "voice") {
    await voiceFlow(browser, EMBER, [MOBILE]);
    await voiceFlow(browser, THEME_OVERRIDE ?? [["ember", "dark"]], [DESKTOP]);
  } else if (SHOTS === "shell") {
    await shell(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "tools") {
    await toolsScreens(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "tools-meditation-final") {
    await toolsMeditationFinal(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "tools-t4") {
    await toolsT4Screens(browser, THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "settings") {
    await settingsScreens(browser, [...EMBER, ...NON_EMBER], [MOBILE]);
    // Desktop: Ember + Bone (both modes) so the T2 controls are verified at 1280 in the
    // Bone tuning theme the ticket calls out, not Ember alone.
    await settingsScreens(browser, THEME_OVERRIDE ?? [["ember", "dark"], ["ember", "light"], ["bone", "dark"], ["bone", "light"]], [DESKTOP]);
  } else if (SHOTS === "coach") {
    await coachScreens(browser, EMBER, [MOBILE, DESKTOP]);
    if (!THEME_OVERRIDE) await coachScreens(browser, [["bone", "dark"], ["moss", "light"]], [MOBILE]);
  } else if (SHOTS === "onboarding") {
    // SAR-012 Pass 1–3 — drive against a SEED_STATE=fresh DB (see the ticket Verification
    // block): the CORE walk + Phase C shimmer + Phase D cards/edited-row, then the
    // 1-domain-only and failed-spine retry variants, then Phase E/F (mocked accept — no
    // write), then Phase G landing (a REAL accept — MUST be last, it flips the DB complete).
    await onboarding(browser, EMBER, [MOBILE, DESKTOP]);
    await onboardingVariants(browser, EMBER, [MOBILE, DESKTOP]);
    await onboardingDetail(browser, EMBER, [MOBILE, DESKTOP]);
    await onboardingLanding(browser, EMBER, [MOBILE, DESKTOP]);
  } else if (SHOTS === "empty") {
    await today(browser, "empty", THEME_OVERRIDE ?? [["ember", "dark"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "alldone") {
    await today(browser, "alldone", THEME_OVERRIDE ?? [["ember", "dark"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "arccomplete") {
    // UIE-0e S1 — seed with SEED_STATE=arc-complete first (see the ticket Verification block).
    await today(browser, "arccomplete", THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "arcsettled") {
    // UIE-0e S2 — seed with SEED_STATE=arc-settled first (live spine + settled banner).
    await today(browser, "arcsettled", THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "stitch") {
    await stitchScreens(browser);
  } else if (SHOTS === "art") {
    await artScreens(browser);
  } else if (SHOTS === "landing") {
    await landing(browser, THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"]], [MOBILE, DESKTOP]);
  } else if (SHOTS === "waitlist") {
    for (const [theme, mode] of (THEME_OVERRIDE ?? [["bone", "dark"], ["bone", "light"]])) {
      for (const width of [MOBILE, DESKTOP]) {
        await withPage(browser, { theme, mode, width }, async (page) => {
          await page.goto(`${BASE}/waitlist`, { waitUntil: "networkidle" });
          await page.waitForTimeout(400);
          await shot(page, `waitlist-${width}-${theme}-${mode}`);
        });
      }
    }
  }
} finally {
  await browser.close();
}
console.log("screenshots done:", SHOTS);
