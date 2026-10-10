# Sarthi — your life coach inside ChatGPT, where AI never writes a guess without asking

**Live app:** https://sarthi-gray.vercel.app · **Try the demo:** https://sarthi-gray.vercel.app/api/try-demo ·
**Code:** https://github.com/SawhneySatvik/Sarthi/tree/hack/devday-chatgpt ·
**ChatGPT plugin (MCP):** `https://sarthi-gray.vercel.app/mcp/<secret>` (URL shared with judges in the submission form)

## The product
Sarthi is a voice-and-chat life coach. You describe your day the way you'd tell a friend — *"spent 450 on a team
lunch, had a paneer wrap and lassi, 45 min of system design"* — and Sarthi turns it into typed entries across four
areas of your life at once: **Health, Money, Habits and Skills**. It keeps your daily plan, streaks and XP, and a
coach reacts to what you actually did.

Its one rule is what makes it different: **nothing estimated is ever saved without your confirmation.** The numbers
you said are filed instantly; anything an AI had to guess (the calories in that wrap, the millilitres in "a bottle")
becomes a card you Keep, Edit or Discard. Every save can be undone.

**Who it's for:** people who want to track their life — food, spending, habits, learning — but quit apps because
logging is tedious, and don't trust AI loggers that quietly invent numbers.

## What we built for DevDay: Sarthi inside ChatGPT
You no longer open Sarthi to log your life — you just talk to ChatGPT.

1. **Talk, and Sarthi files it.** ChatGPT's model turns your sentence into Sarthi's typed entries through a
   ChatGPT plugin. Sarthi's server — not the model — decides what is safe to save.
2. **An inline Sarthi panel in the chat.** Right under ChatGPT's reply: *Needs your OK* cards with the reason
   ("ChatGPT estimated 650 kcal — that number isn't in your words"), *Filed just now* with Undo, today's to-dos, and
   Today tiles for all four areas, in Sarthi's own art style.
3. **Only your tap confirms.** The confirm tool is callable only from the panel, never by the model, and every card
   carries a signature the model never sees. If ChatGPT tries to confirm a guess itself, Sarthi refuses.
4. **Your own space, built by talking.** Every ChatGPT account gets its own private Sarthi space automatically. A new
   user says *"I track meditation and water, I'm learning DSA"* and Sarthi sets it up — no forms.
5. **A quick to-do layer.** *"Add 'submit the DevDay project' to my day"* — it shows up as a task in the Sarthi web
   app's Today, and *"done with the DevDay project"* ticks it off.
6. **One engine, two surfaces.** What you log in ChatGPT appears in the Sarthi web app with a **"via ChatGPT"**
   badge; matching plan tasks tick themselves, and the coach line reacts to the new entries.

## How it uses OpenAI's DevDay launches — and where each one helps
| OpenAI capability | Where it's used in Sarthi | Why it's useful |
|---|---|---|
| **ChatGPT plugins (MCP Apps)** | Sarthi runs as an MCP server; its panel is an MCP Apps resource rendered **inline** in the conversation, with a sidebar launcher and live status text ("Checking your words…" → "Sarthi decided"). | Logging happens where people already spend their time; the panel makes confirmation a single tap instead of a form. |
| **App-only tool visibility** | `confirm_entry` is visible only to the panel (`ui.visibility: ["app"]`), never to the model. | Turns "only the user confirms" from a prompt instruction into a platform guarantee. |
| **ChatGPT's model as the parser** | ChatGPT fills Sarthi's typed tool schema (amounts, items, minutes, habits) directly — no second parsing call. | Understanding stays with the strongest model in the loop; Sarthi spends its effort on verification. |
| **Decisions API (GPT-6 Luna)** | A second, independent verifier before anything is saved: a **predicate** per number ("did the user actually state this?") and a **choice** that maps "sys design" or "my meditation" onto *your* existing skills and habits. Batched into one call per message, capped and cached. | Fast, typed judgments instead of free text. Luna can only make Sarthi **stricter** — demote a value to a card or pick one of your names — never promote a guess or invent something. |
| **Per-user request metadata** | ChatGPT's anonymized user ID gives each account its own Sarthi space; the user's location timezone decides what "today" means. | Multi-user from day one, with each person's data isolated, and no account setup. |

Behind the plugin, Sarthi also runs a plain-code check: any number the model supplies that does not appear in your
own words becomes a card. Two independent checks — code and Luna — have to agree before a value is saved silently.

## Built to be trusted
- Money and quantities are stored as whole units (paise, ml, minutes, grams) — no floating-point money.
- Every entry goes into its own typed table through one commit path, and every save is undoable.
- Unknown names are asked about, never invented; retries never save twice.
- The plugin endpoint uses a secret path, request-size limits, input limits, and never leaks internal errors.
- Provider-agnostic runtime: OpenAI, Google Gemini, Anthropic, NVIDIA NIM and OpenRouter behind one interface,
  plus a deterministic fake model so the whole app — and its 340+ tests — run with no API keys.

## Try it
1. Open https://sarthi-gray.vercel.app/api/try-demo to explore the web app with demo data.
2. In ChatGPT (developer mode): **Plugins → Add custom MCP server →** the plugin URL → **No authentication → Refresh**.
3. *"Set up my Sarthi: I track meditation and water, I'm learning DSA."*
4. *"Spent 450 on a team lunch, had a paneer wrap and lassi, 45 min of DSA."* — ₹450 and 45 min are filed; the meal
   waits as a card. Tap **Keep**.
5. *"Add 'submit DevDay project' to my day."* · *"Undo that."* · *"What does my day look like?"*

## What's next
Sign in with your Sarthi account inside ChatGPT (OAuth) so the plugin and the web app share one account; a native
iOS app with Apple Health is in progress on a separate branch.
