import { useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell } from 'lucide-react';
import type { Exercise } from '@arcadia/shared';
import { Lightbox } from '@/components/Lightbox';

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const muscles = exercise.primaryMuscles.map((m) => m.commonName).join(', ');
  const [preview, setPreview] = useState(false);
  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {exercise.imageUrls[0] ? (
        <button
          type="button"
          aria-label={`Preview ${exercise.name} photos`}
          onClick={(e) => {
            // The card is a link — the thumbnail opens the preview instead.
            e.preventDefault();
            e.stopPropagation();
            setPreview(true);
          }}
          className="shrink-0 cursor-zoom-in"
        >
          <img
            src={exercise.imageUrls[0]}
            alt=""
            loading="lazy"
            className="h-14 w-14 rounded-xl bg-white object-contain transition-transform hover:scale-105"
          />
        </button>
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Dumbbell size={22} strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold">{exercise.name}</p>
        <p className="truncate text-sm text-muted">
          {exercise.category?.name}
          {muscles ? ` · ${muscles}` : ''}
        </p>
      </div>
      {preview && (
        <Lightbox
          images={exercise.imageUrls}
          alt={exercise.name}
          onClose={() => setPreview(false)}
        />
      )}
    </Link>
  );
}
