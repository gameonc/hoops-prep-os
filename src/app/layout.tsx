import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hoops Prep OS",
  description: "AI training + recovery agent for basketball players.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-court-bg text-court-text font-display">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between mb-8">
            <a href="/" className="text-xl font-semibold tracking-tight">
              <span className="text-court-accent">Hoops</span> Prep OS
            </a>
            <nav className="flex gap-4 text-sm text-court-muted">
              <a href="/dashboard" className="hover:text-court-text">Today</a>
              <a href="/schedule" className="hover:text-court-text">Schedule</a>
              <a href="/log" className="hover:text-court-text">Recovery log</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
