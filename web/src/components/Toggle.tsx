interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-50 ${checked ? "border-accent bg-accent" : "border-line bg-raised"}`}>
      <span className={`absolute top-[3px] size-4 rounded-full bg-canvas transition-transform ${checked ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
    </button>
  );
}