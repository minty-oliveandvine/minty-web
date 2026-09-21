/** The list's search box (Figma 04-C): a grey rounded field with the glass. */

export function SearchField({
  value,
  onChange,
  label = "Search subscriptions and trials",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="flex h-[62px] items-center gap-3 rounded-xl bg-[#f2f5f7] px-6 text-base text-ink">
      <span aria-hidden>🔍</span>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--quiet)]"
      />
    </label>
  );
}
