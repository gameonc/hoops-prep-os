"use client";

import { useEffect, useState } from "react";

type Game = { id: string; tipoff_at: string; opponent: string; home: boolean; travel_km: number; importance: number };

export default function SchedulePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [form, setForm] = useState({ tipoff_at: "", opponent: "", home: true, travel_km: 0, importance: 3, notes: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/schedule");
    const j = await r.json();
    setGames(j.games ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Adding…");
    const r = await fetch("/api/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (r.ok) { setMsg("Added."); load(); setForm({ tipoff_at: "", opponent: "", home: true, travel_km: 0, importance: 3, notes: "" }); }
    else setMsg(`Error: ${JSON.stringify(j.error)}`);
  };

  return (
    <main className="grid md:grid-cols-2 gap-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Upcoming games</h1>
        {games.length === 0 && <div className="text-court-muted">Nothing on the calendar yet.</div>}
        <ul className="space-y-3">
          {games.map((g) => (
            <li key={g.id} className="rounded-lg border border-court-border p-4 bg-court-surface">
              <div className="flex justify-between">
                <div className="font-medium">{new Date(g.tipoff_at).toLocaleString()}</div>
                <div className="text-xs text-court-muted">Importance {g.importance}/5</div>
              </div>
              <div className="text-sm text-court-muted mt-1">
                {g.home ? "vs" : "@"} {g.opponent || "TBD"}{g.travel_km ? ` · ${g.travel_km} km` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add a game</h2>
        <form onSubmit={add} className="space-y-3">
          <input type="datetime-local" required value={form.tipoff_at}
            onChange={(e) => setForm({ ...form, tipoff_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
            className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
          <input placeholder="Opponent" value={form.opponent}
            onChange={(e) => setForm({ ...form, opponent: e.target.value })}
            className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.home} onChange={(e) => setForm({ ...form, home: e.target.checked })} />
            Home game
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-court-muted">Travel (km)</span>
              <input type="number" min={0} value={form.travel_km}
                onChange={(e) => setForm({ ...form, travel_km: Number(e.target.value) })}
                className="mt-1 w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-court-muted">Importance 1–5</span>
              <input type="number" min={1} max={5} value={form.importance}
                onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                className="mt-1 w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
            </label>
          </div>
          <button type="submit" className="rounded-lg px-4 py-2 bg-court-accent text-black font-semibold">Add game</button>
          {msg && <div className="text-sm text-court-muted">{msg}</div>}
        </form>
      </section>
    </main>
  );
}
