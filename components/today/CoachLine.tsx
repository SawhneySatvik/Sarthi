/** The one-line coach brief (Fraunces, relaxed leading). Null → renders nothing. */
export function CoachLine({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="px-4 py-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{text}</p>;
}
