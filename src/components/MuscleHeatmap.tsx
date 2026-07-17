import { muscleImage } from "@/lib/rapidapi/muscleImage";

/**
 * Renders an anatomical heatmap for the given muscle-set counts.
 * Colors: darker/redder = more sets that week.
 */
export default function MuscleHeatmap({ muscles }: { muscles: string[] }) {
  if (!muscles.length) {
    return (
      <div className="rounded-xl border border-court-border bg-court-surface p-5 text-sm text-court-muted">
        No sessions yet this week — log one to see your muscle exposure map.
      </div>
    );
  }
  const url = muscleImage.highlightUrl(muscles, "#FF6B35", false);
  return (
    <div className="rounded-xl border border-court-border bg-court-surface p-4">
      <div className="text-sm text-court-muted mb-2">Weekly muscle exposure</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="muscle heatmap" className="w-full max-w-sm mx-auto" />
    </div>
  );
}
