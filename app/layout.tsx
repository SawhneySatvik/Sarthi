import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sarthi",
  description: "A voice-and-photo life coach.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="ember" data-mode="dark">
      <body>{children}</body>
    </html>
  );
}
