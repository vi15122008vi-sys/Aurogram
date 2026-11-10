import { motion } from "framer-motion";

const strokes = ["M9 39 24 8", "M24 8 39 39", "M16 27h16"];

export function SplashScreen() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-[72px] place-items-center rounded-[22px] border border-accent/20 bg-accent/10 shadow-[0_0_60px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
          <svg viewBox="0 0 48 48" className="size-10 overflow-visible" fill="none" aria-label="Aurogram">
            {strokes.map((d, index) => (
              <motion.path
                key={d}
                d={d}
                stroke="var(--accent)"
                strokeWidth="3.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.3 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, delay: index * 0.14, ease: "easeInOut" }}
              />
            ))}
          </svg>
        </div>
        <motion.span className="text-sm font-semibold tracking-wide text-ink" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.35 }}>
          Aurogram
        </motion.span>
      </div>
    </main>
  );
}
