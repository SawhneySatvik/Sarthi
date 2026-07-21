import assert from "node:assert/strict";
import test from "node:test";

import type { VoiceAudio, VoiceProvider } from "../core/contracts";
import { MAX_VOICE_DURATION_MS, transcribeVoice } from "../core/voice";
import { createVoiceProvider } from "../providers";

const VALID_AUDIO: VoiceAudio = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm",
  durationMs: 500,
};

test("voice transcription uses the deterministic keyless fake provider", async () => {
  const outcome = await transcribeVoice(VALID_AUDIO, createVoiceProvider("fake"));
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.transcription.confidenceBps, 9800);
    assert.match(outcome.transcription.text, /Spent 340 on lunch/);
  }
});

test("audio/mp4 is accepted for iOS recorders without changing fake-stack output", async () => {
  const outcome = await transcribeVoice(
    { ...VALID_AUDIO, mimeType: "audio/mp4" },
    createVoiceProvider("fake"),
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.transcription.confidenceBps, 9800);
    assert.match(outcome.transcription.text, /Spent 340 on lunch/);
  }
});

test("over-limit audio is rejected before VoiceProvider invocation", async () => {
  let calls = 0;
  const provider: VoiceProvider = {
    async transcribe() {
      calls += 1;
      throw new Error("should not run");
    },
  };
  const outcome = await transcribeVoice({ ...VALID_AUDIO, durationMs: MAX_VOICE_DURATION_MS + 1 }, provider);
  assert.deepEqual(outcome, { ok: false, retryable: true, error: "invalid-duration" });
  assert.equal(calls, 0);
});

test("provider failure remains retryable and has no persistence surface", async () => {
  const provider: VoiceProvider = {
    async transcribe() {
      throw new Error("provider unavailable");
    },
  };
  const outcome = await transcribeVoice(VALID_AUDIO, provider);
  assert.deepEqual(outcome, { ok: false, retryable: true, error: "provider-unavailable" });
});

test("an unsupported live provider fails explicitly at transcription, not session composition", async () => {
  const outcome = await transcribeVoice(VALID_AUDIO, createVoiceProvider("gemini"));
  assert.deepEqual(outcome, { ok: false, retryable: true, error: "provider-not-configured" });
});
