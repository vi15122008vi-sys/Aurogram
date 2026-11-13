import { Plus } from "lucide-react";

interface FabProps {
  onClick: () => void;
  label: string;
}

/** Плавающая кнопка создания: стеклянный круг с акцентной заливкой над BottomNav. */
export function Fab({ onClick, label }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_16px_36px_color-mix(in_srgb,var(--accent)_38%,transparent),inset_0_1px_0_rgb(255_255_255_/_35%)] transition duration-200 hover:bg-accent-strong active:scale-95 motion-reduce:transition-none sm:right-6"
    >
      <Plus size={24} strokeWidth={2.2} />
    </button>
  );
}
