type BlockExercise = {
  exercise_id?: string;
  name: string;
  sets: number;
  reps: string;
  load?: string;
  rest_sec: number;
  gifUrl?: string;
  target?: string;
  notes?: string;
};

type Block = {
  name: string;
  order: number;
  exercises: BlockExercise[];
};

export default function PlanBlocks({ blocks }: { blocks: Block[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Today's session</h2>
      {sorted.map((b) => (
        <div key={b.order} className="rounded-xl border border-court-border bg-court-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-court-border flex items-center justify-between">
            <div className="font-semibold">{b.name}</div>
            <div className="text-xs text-court-muted">{b.exercises.length} exercises</div>
          </div>
          <div className="divide-y divide-court-border">
            {b.exercises.map((e, idx) => (
              <div key={idx} className="px-5 py-4 flex gap-4 items-start">
                {e.gifUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.gifUrl} alt={e.name} className="w-20 h-20 rounded-md object-cover bg-black/40" />
                ) : (
                  <div className="w-20 h-20 rounded-md bg-court-bg border border-court-border flex items-center justify-center text-court-muted text-xs">
                    {e.target ?? "—"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-court-muted mt-1">
                    {e.sets} × {e.reps}
                    {e.load ? ` · ${e.load}` : ""}
                    {e.rest_sec ? ` · ${e.rest_sec}s rest` : ""}
                  </div>
                  {e.notes && <div className="text-xs text-court-muted mt-1">{e.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
