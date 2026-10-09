/**
 * The seed for Part 3's MAINTENANCE_MODE (cross-cutting rule 8): a cutover window is held by a
 * switch that sends every page here, never by improvisation. Static on purpose - it must render
 * when nothing behind it does.
 */
export default function Maintenance() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-card p-6">
        <h1 className="text-title-l font-semibold text-ink">Minty is being updated</h1>
        <p className="mt-2 text-body-m text-ink-2">
          We&apos;re doing some maintenance. Please try again in a few minutes.
        </p>
      </div>
    </main>
  );
}
