import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

/** Browser-chrome frame for product screenshots on the landing page.
 *
 * Drop real captures into apps/web/public/marketing/ (e.g. dashboard.png)
 * and reference them as src="/marketing/dashboard.png". Until a file exists
 * the frame renders a labeled placeholder instead of a broken image, so the
 * page ships before every screenshot does. */
export function Screenshot({
  src,
  alt,
  label,
  className = '',
}: {
  src: string;
  alt: string;
  /** Shown inside the placeholder while the image file doesn't exist yet. */
  label: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12] shadow-[0_20px_80px_-20px_rgba(34,211,238,0.25)] ${className}`}
    >
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      {missing ? (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(232,121,249,0.12),transparent_60%)]">
          <ImageIcon size={22} className="text-white/25" aria-hidden />
          <p className="text-sm text-white/35">{label}</p>
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setMissing(true)} />
      )}
    </div>
  );
}
