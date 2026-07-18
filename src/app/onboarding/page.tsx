"use client";

import { useEffect, useState } from "react";

export default function Onboarding() {
  const [form, setForm] = useState({
    display_name: "",
    position: "G",
    height_cm: 190,
    weight_kg: 85,
    training_age_years: 3,
    city: "",
    country: "US",
    lat: "" as string | number,
    lon: "" as string | number,
    season_phase: "offseason",
    equipment: ["barbell","dumbbell","body weight","resistance band"],
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/athlete");
      const j = await r.json();
      if (j.athlete) {
        setForm((f) => ({
          ...f,
          ...j.athlete,
          lat: j.athlete.lat ?? "",
          lon: j.athlete.lon ?? "",
          equipment: j.athlete.equipment ?? f.equipment,
        }));
      }
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Saving…");
    const r = await fetch("/api/athlete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) { setMsg(`Error: ${j.error ?? "save failed"}`); return; }
    setMsg("Saved. Head to your dashboard.");
  };

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Athlete profile</h1>
      <p className="text-court-muted text-sm mb-6">Sets your position priorities and unlocks environment-aware plans.</p>
      <form onSubmit={save} className="space-y-3">
        <Field label="Display name">
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Position">
            <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2">
              {["PG","SG","SF","PF","C","G","F","U"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Season phase">
            <select value={form.season_phase} onChange={(e) => setForm({ ...form, season_phase: e.target.value })}
              className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2">
              {["offseason","preseason","in-season","playoffs"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Height (cm)"><NumIn v={form.height_cm} on={(v) => setForm({ ...form, height_cm: v })} /></Field>
          <Field label="Weight (kg)"><NumIn v={form.weight_kg} on={(v) => setForm({ ...form, weight_kg: v })} /></Field>
          <Field label="Training age (yrs)"><NumIn v={form.training_age_years} on={(v) => setForm({ ...form, training_age_years: v })} step={0.5} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Ocoee"
              className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
          </Field>
        </div>

        {/* Optional coords — hidden by default so onboarding doesn't feel gnarly */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowCoords((s) => !s)}
            className="text-xs text-court-muted hover:text-court-text"
          >
            {showCoords ? "Hide" : "+ Add"} home coordinates (optional — enables air-quality-aware plans)
          </button>
          {showCoords && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Field label="Latitude (e.g. 28.5695)">
                <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  placeholder="28.5695"
                  className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
              </Field>
              <Field label="Longitude (e.g. -81.5460)">
                <input value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })}
                  placeholder="-81.5460"
                  className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
              </Field>
            </div>
          )}
        </div>

        <button type="submit" className="rounded-lg px-4 py-2 bg-court-accent text-black font-semibold">Save profile</button>
        {msg && <div className="text-sm text-court-muted">{msg}</div>}
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm text-court-muted">{label}</span>{children}</label>;
}
function NumIn({ v, on, step = 1 }: { v: number | string; on: (n: number) => void; step?: number }) {
  return <input type="number" step={step} value={v} onChange={(e) => on(Number(e.target.value))}
    className="w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />;
}
