import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface LightboxProps {
  images: string[];
  alt: string;
  startIndex?: number;
  onClose: () => void;
}

/** Full-screen image preview. Rendered through a portal so it can be mounted
 * from inside a Link/card without the overlay living inside the anchor; click
 * handlers stop propagation because React events still bubble through the
 * component tree (not the DOM) from portals. Esc/arrows navigate. */
export function Lightbox({ images, alt, startIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const many = images.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    // Freeze the page behind the overlay while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [images.length, onClose]);

  const navButton =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} image preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className={`absolute top-4 right-4 ${navButton}`}
      >
        <X size={20} aria-hidden />
      </button>

      <div className="flex w-full max-w-4xl items-center justify-center gap-2 md:gap-4">
        {many && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i - 1 + images.length) % images.length);
            }}
            className={navButton}
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}

        <figure
          className="min-w-0 text-center"
          onClick={(e) => {
            // Clicking the image itself should not close the overlay.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <img
            src={images[index]}
            alt={alt}
            className="max-h-[80vh] w-auto max-w-full rounded-2xl bg-white object-contain"
          />
          <figcaption className="mt-3 text-sm text-white/80">
            {alt}
            {many && <span className="tabular-nums"> · {index + 1} / {images.length}</span>}
          </figcaption>
        </figure>

        {many && (
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i + 1) % images.length);
            }}
            className={navButton}
          >
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
