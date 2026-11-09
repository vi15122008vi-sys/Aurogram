import { EyeOff } from "lucide-react";

interface GhostIndicatorProps {
  active?: boolean;
  label?: string;
}

export function GhostIndicator({ active = false, label = "Ghost" }: GhostIndicatorProps) {
  if (!active) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-lg border border-ghost/20 bg-ghost/5 px-2 py-1 text-[10px] font-medium text-ghost"><EyeOff size={12} strokeWidth={1.6} />{label}</span>;
}