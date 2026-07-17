import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "./lib/fonts";

export const metadata: Metadata = {
  title: "Sarthi",
  description: "A voice-and-photo life coach.",
};

/*
 * Pre-paint theme script (SAR-005, D-C): set [data-theme][data-mode] on <html>
 * from localStorage before first paint, so there is no flash of the default theme.
 * Falls back to Ember + the OS colour-scheme preference. Kept tiny + defensive.
 */
const THEME_SCRIPT = `(function(){try{var t='ember',m=null,s=localStorage.getItem('sarthi-theme');if(s){var p=JSON.parse(s);t=p.theme||t;m=p.mode||null;}if(!m){m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var e=document.documentElement;e.setAttribute('data-theme',t);e.setAttribute('data-mode',m);}catch(_){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="ember" data-mode="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
