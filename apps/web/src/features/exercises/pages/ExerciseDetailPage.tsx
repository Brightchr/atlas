import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Lightbox } from '@/components/Lightbox';
import { useExercise } from '../api';

export function ExerciseDetailPage() {
  const { id } = useParams();
  const query = useExercise(Number(id));
  const [preview, setPreview] = useState<number | null>(null);

  if (query.isLoading) {
    return <p className="p-4 text-muted md:p-6">Loading…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <p className="text-rose-500">Could not load this exercise.</p>
        <Link to="/exercises" className="font-medium text-accent hover:underline">
          Back to exercises
        </Link>
      </div>
    );
  }

  const exercise = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link
        to="/exercises"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        <ArrowLeft size={15} aria-hidden />
        Exercises
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{exercise.name}</h1>
        {exercise.category && (
          <span className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            {exercise.category.name}
          </span>
        )}
      </header>

      {exercise.imageUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {exercise.imageUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Preview photo ${i + 1} of ${exercise.name}`}
              onClick={() => setPreview(i)}
              className="shrink-0 cursor-zoom-in"
            >
              <img
                src={url}
                alt={exercise.name}
                className="h-44 rounded-2xl border border-line bg-white object-contain p-2 transition-transform hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      )}
      {preview !== null && (
        <Lightbox
          images={exercise.imageUrls}
          alt={exercise.name}
          startIndex={preview}
          onClose={() => setPreview(null)}
        />
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            Primary muscles
          </h2>
          <p className="mt-1 font-medium">
            {exercise.primaryMuscles.map((m) => m.commonName).join(', ') || '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            Secondary muscles
          </h2>
          <p className="mt-1 font-medium">
            {exercise.secondaryMuscles.map((m) => m.commonName).join(', ') || '—'}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Equipment</h2>
          <p className="mt-1 font-medium">
            {exercise.equipment.map((e) => e.name).join(', ') || 'None'}
          </p>
        </div>
      </section>

      {exercise.description && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">How to</h2>
          {/* Description is HTML we build ourselves from the catalog's
              instruction steps (escaped in the exercise-db mapper). */}
          <div
            className="mt-2 space-y-2 text-sm leading-relaxed [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: exercise.description }}
          />
        </section>
      )}
    </div>
  );
}
