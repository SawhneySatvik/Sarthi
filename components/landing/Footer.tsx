import { Wordmark } from "./Wordmark";

/*
 * Footer — quiet close on paper. Wordmark + the build-week line, nothing more.
 */
export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Wordmark className="text-ink-1" />
        <p className="font-ui text-caption text-ink-3">
          Built for OpenAI Build Week — Apps for your life.
        </p>
      </div>
    </footer>
  );
}
