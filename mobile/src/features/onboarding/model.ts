export type OnboardingAnswer = string | number | string[];
export type OnboardingDraft = { stepId: string; answers: Record<string, OnboardingAnswer>; selectedDomains: string[] };
export type OnboardingDraftStore = { load(): Promise<OnboardingDraft | null>; save(draft: OnboardingDraft): Promise<void>; clear(): Promise<void> };
export type OnboardingQuestion = { id: string; phase: 'core' | 'detail'; title: string; prompt?: string; options?: { id: string; label: string }[]; multi?: boolean; required?: boolean };

export function isQuestionAnswered(question: OnboardingQuestion, answer: OnboardingAnswer | undefined): boolean { if (!question.required) return true; if (Array.isArray(answer)) return answer.length > 0; return answer !== undefined && answer !== ''; }
export function updateAnswer(draft: OnboardingDraft, question: OnboardingQuestion, value: string): OnboardingDraft { const previous = draft.answers[question.id]; const next = question.multi ? Array.isArray(previous) && previous.includes(value) ? previous.filter((entry) => entry !== value) : [...(Array.isArray(previous) ? previous : []), value] : value; return { ...draft, answers: { ...draft.answers, [question.id]: next } }; }
export function integerAnswer(value: string): number | null { const parsed = Number.parseInt(value, 10); return Number.isSafeInteger(parsed) ? parsed : null; }
