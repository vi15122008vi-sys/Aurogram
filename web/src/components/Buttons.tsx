import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  tone?: "accent" | "glass" | "danger";
}

const TONES: Record<string, string> = {
  accent: "bg-accent text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_32%,transparent)]",
  glass: "bg-[rgb(255_255_255_/_0.05)] text-ink shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)] backdrop-blur-[24px]",
  danger: "bg-danger/15 text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_22%,transparent)]",
};

/** Кнопка в стиле Liquid Glass: полупрозрачный фон, blur и spring-нажатие. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { children, tone = "accent", className = "", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 520, damping: 26 }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full backdrop-blur-[24px] transition-colors duration-200 disabled:opacity-50 ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
