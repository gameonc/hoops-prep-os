"use client";

import { useState } from "react";

export default function LogPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    log_date: today,
    sleep_hours: 7.5,
    sleep_quality: 7,
    soreness: 3,
    stress: 4,
    hrv_ms: "",
    resting_hr: "",
    mood: 7,
    notes: "",
  });
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Saving…");
    const payload: any = { ...form };
    payload.hrv_ms = form.hrv_ms ? Number(form.hrv_ms) : undefined;
    payload.resting_hr = form.resting_hr ? Number(form.resting_hr) : undefined;
    const r = await fetch("/api/recovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    setStatus(r.ok ? "Saved. Head to Today to build the plan." : `Error: ${JSON.stringify(j.error)}`);
  };

  const N = (k: keyof typeof form, min: number, max: number, step = 1) => (
    <label className="block">
      <span className="text-sm text-court-muted capitalize">{String(k).replace(/_/g, " ")}</span>
      <input
        type="number" min={min} max={max} step={step}
        value={form[k] as any}
        onChange={(e) => setForm({ ...form, [k]: e.target.value === "" ? "" : Number(e.target.value) })}
        className="mt-1 w-full rounded-md bg-court-bg border border-court-border px-3 py-2 focus:border-court-accent outline-none"
      />
    </label>
  );

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Morning check-in</h1>
      <p className="text-court-muted text-sm mb-6">
        Takes 30 seconds. HRV + RHR are optional — plug them in if your wearable gives them to you.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-court-muted">Date</span>
          <input type="date" value={form.log_date}
            onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            className="mt-1 w-full rounded-md bg-court-bg border border-court-border px-3 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          {N("sleep_hours", 0, 14, 0.25)}
          {N("sleep_quality", 1, 10)}
          {N("soreness", 1, 10)}
          {N("stress", 1, 10)}
          {N("hrv_ms", 0, 300)}
          {N("resting_hr", 30, 120)}
          {N("mood", 1, 10)}
        </div>
        <label className="block">
          <span className="text-sm text-court-muted">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md bg-court-bg border border-court-border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-lg px-4 py-2 bg-court-accent text-black font-semibold">Save check-in</button>
        {status && <div className="text-sm text-court-muted">{status}</div>}
      </form>
    </main>
  );
}
