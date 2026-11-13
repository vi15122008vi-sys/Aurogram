import { useCallback, useEffect, useRef, useState } from "react";
import { themeList, type ThemeId } from "../lib/themes";

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  rotate: number;
}

const CONFETTI_COLORS = ["#FFD700", "#FFE44D", "#C0C0C0", "#93C5FD", "#F472B6"];

function currentDecor(): "snow" | "confetti" | null {
  const id = (document.documentElement.dataset.theme || "aurogram") as ThemeId;
  return themeList.find((theme) => theme.id === id)?.decor ?? null;
}

/**
 * Праздничный декор тем: снежинки для Christmas и конфетти-клик для New Year.
 * Отключается режимом энергосбережения (data-energy="on").
 */
export function ThemeEffects() {
  const [decor, setDecor] = useState<"snow" | "confetti" | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const sync = () => setDecor(currentDecor());
    sync();
    window.addEventListener("aurogram:theme", sync);
    return () => window.removeEventListener("aurogram:theme", sync);
  }, []);

  const spawn = useCallback((event: PointerEvent) => {
    if (document.documentElement.dataset.energy === "on") return;
    const created: Particle[] = Array.from({ length: 8 }).map(() => ({
      id: counter.current++,
      x: event.clientX,
      y: event.clientY,
      dx: (Math.random() - 0.5) * 180,
      dy: -Math.random() * 140 - 30,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotate: Math.random() * 360,
    }));
    setParticles((current) => [...current, ...created]);
    window.setTimeout(() => {
      const ids = new Set(created.map((item) => item.id));
      setParticles((current) => current.filter((item) => !ids.has(item.id)));
    }, 800);
  }, []);

  useEffect(() => {
    if (decor !== "confetti") return;
    window.addEventListener("pointerdown", spawn);
    return () => window.removeEventListener("pointerdown", spawn);
  }, [decor, spawn]);

  if (!decor) return null;

  if (decor === "snow") {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, index) => (
          <span
            key={index}
            className="snowflake"
            style={{
              left: `${(index * 4.7 + Math.random() * 4) % 100}%`,
              animationDuration: `${7 + (index % 7) * 1.4}s`,
              animationDelay: `${(index % 9) * 0.9}s`,
              fontSize: `${10 + (index % 5) * 3}px`,
              opacity: 0.5 + (index % 4) * 0.12,
            }}
          >
            ❄
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="confetti"
          style={{
            left: particle.x,
            top: particle.y,
            background: particle.color,
            transform: `rotate(${particle.rotate}deg)`,
            ["--dx" as string]: `${particle.dx}px`,
            ["--dy" as string]: `${particle.dy + 220}px`,
          }}
        />
      ))}
    </div>
  );
}
