/** Deterministic, keyless SAR-016 eval inputs — no client time/user/payload fields. */
export const timerSessionFixture = {
  id: "timer-session",
  focus: {
    minutes: 25,
    idempotencyKey: "51ed86e8-90f7-4caf-9a63-61044b2396cd",
  },
  meditation: {
    minutes: 10,
    patternId: "ten" as const,
    idempotencyKey: "667f794b-18c7-436f-851d-176cc1a89311",
  },
  declinedMeditation: {
    minutes: 5,
    patternId: "calm" as const,
    idempotencyKey: "d8800234-5229-4916-80d4-2ee99bf38c10",
  },
} as const;
