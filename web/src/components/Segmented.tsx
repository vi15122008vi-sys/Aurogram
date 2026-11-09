interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)} className={`min-h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition ${selected ? "bg-accent/10 text-accent" : "text-muted hover:bg-raised hover:text-ink"}`}>{option.label}</button>;
      })}
    </div>
  );
}