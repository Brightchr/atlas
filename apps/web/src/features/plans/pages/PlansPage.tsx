export function PlansPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="text-sm text-muted">Training and diet plans — yours and provided.</p>
      </header>
      <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center text-muted">
        <p className="font-semibold text-ink">Coming up next</p>
        <p className="mt-1 text-sm">
          Weekly training plans (map workouts to days) and diet plans (recipes per meal). The
          database schema for both already exists — this page is the next build target.
        </p>
      </div>
    </div>
  );
}
