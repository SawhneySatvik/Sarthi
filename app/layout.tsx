import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./lib/fonts";
import { CANVAS_DARK, CANVAS_LIGHT } from "./lib/brand-canvas";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { OfflineQueueReplay } from "@/components/pwa/OfflineQueueReplay";

export const metadata: Metadata = {
  title: "Sarthi",
  description: "A voice-and-photo life coach.",
  applicationName: "Sarthi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sarthi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: CANVAS_DARK },
    { media: "(prefers-color-scheme: light)", color: CANVAS_LIGHT },
  ],
};

/*
 * Pre-paint theme script (SAR-005, D-C): set [data-theme][data-mode] on <html>
 * from localStorage before first paint, so there is no flash of the default theme.
 */
const THEME_SCRIPT = `(function(){try{var t='bone',m='system',s=localStorage.getItem('sarthi-theme');if(s){var p=JSON.parse(s);t=p.theme||t;m=p.mode||m;}if(m==='system'){m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var e=document.documentElement;e.setAttribute('data-theme',t);e.setAttribute('data-mode',m);}catch(_){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="bone" data-mode="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
        <OfflineQueueReplay />
      </body>
    </html>
  );
}
