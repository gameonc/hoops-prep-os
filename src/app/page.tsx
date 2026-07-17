import Link from "next/link";

export default function Home() {
  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight">
          Train like the season depends on it.
        </h1>
        <p className="mt-3 text-court-muted max-w-2xl">
          Hoops Prep OS reads your sleep, HRV, soreness, upcoming games, travel,
          and even the air outside — and tells you exactly what to lift today.
          Built for hoopers, not for bros.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/onboarding" className="rounded-lg px-4 py-2 bg-court-accent text-black font-semibold hover:opacity-90">
            Set up my profile
          </Link>
          <Link href="/dashboard" className="rounded-lg px-4 py-2 border border-court-border hover:border-court-accent">
            Today's plan
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { t: "Readiness engine", d: "Transparent 0–100 score from sleep, HRV, soreness, travel, and AQI." },
          { t: "Game-aware", d: "24–36h out from tipoff, we protect your legs automatically." },
          { t: "Position-specific", d: "PGs get COD & single-leg power. Bigs get hip mobility & landing mechanics." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-court-border p-5 bg-court-surface">
            <h3 className="font-semibold">{c.t}</h3>
            <p className="mt-2 text-sm text-court-muted">{c.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
