/**
 * The seed for Part 3's MAINTENANCE_MODE (cross-cutting rule 8): a cutover window is held by a
 * switch that sends every page here, never by improvisation. Static on purpose - it must render
 * when nothing behind it does.
 */
export default function Maintenance() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Minty is being updated</h1>
      <p className="mt-2 text-muted">
        We&apos;re doing some maintenance. Please try again in a few minutes.
      </p>
    </main>
  );
}
