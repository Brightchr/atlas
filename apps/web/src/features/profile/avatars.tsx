import {
  Anchor,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Medal,
  Mountain,
  Rocket,
  Shield,
  Star,
  Swords,
  Target,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Icon avatars — the app's design language is icons/SVGs, never emoji.
 * Ids are what's stored (profile jsonb + mirrored in the API's allowlist);
 * rendering stays client-side so new icons never need a migration. */

export const AVATAR_ICONS: { id: string; Icon: LucideIcon; label: string }[] = [
  { id: 'dumbbell', Icon: Dumbbell, label: 'Dumbbell' },
  { id: 'mountain', Icon: Mountain, label: 'Mountain' },
  { id: 'flame', Icon: Flame, label: 'Flame' },
  { id: 'zap', Icon: Zap, label: 'Lightning' },
  { id: 'heart-pulse', Icon: HeartPulse, label: 'Heartbeat' },
  { id: 'trophy', Icon: Trophy, label: 'Trophy' },
  { id: 'target', Icon: Target, label: 'Target' },
  { id: 'bike', Icon: Bike, label: 'Bike' },
  { id: 'footprints', Icon: Footprints, label: 'Footprints' },
  { id: 'medal', Icon: Medal, label: 'Medal' },
  { id: 'rocket', Icon: Rocket, label: 'Rocket' },
  { id: 'swords', Icon: Swords, label: 'Swords' },
  { id: 'shield', Icon: Shield, label: 'Shield' },
  { id: 'star', Icon: Star, label: 'Star' },
  { id: 'waves', Icon: Waves, label: 'Waves' },
  { id: 'anchor', Icon: Anchor, label: 'Anchor' },
];

export const AVATAR_TONES: { id: string; classes: string; swatch: string }[] = [
  { id: 'indigo', classes: 'bg-indigo-500/20 text-indigo-400', swatch: 'bg-indigo-500' },
  { id: 'teal', classes: 'bg-teal-500/20 text-teal-500', swatch: 'bg-teal-500' },
  { id: 'orange', classes: 'bg-orange-500/20 text-orange-500', swatch: 'bg-orange-500' },
  { id: 'sky', classes: 'bg-sky-500/20 text-sky-500', swatch: 'bg-sky-500' },
  { id: 'rose', classes: 'bg-rose-500/20 text-rose-500', swatch: 'bg-rose-500' },
  { id: 'emerald', classes: 'bg-emerald-500/20 text-emerald-500', swatch: 'bg-emerald-500' },
  { id: 'amber', classes: 'bg-amber-500/20 text-amber-500', swatch: 'bg-amber-500' },
  { id: 'violet', classes: 'bg-violet-500/20 text-violet-400', swatch: 'bg-violet-500' },
];

const FALLBACK_TONES = AVATAR_TONES.map((t) => t.classes);

function toneFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_TONES[hash % FALLBACK_TONES.length]!;
}

const SIZES = {
  sm: { box: 'h-8 w-8 text-xs', icon: 15 },
  md: { box: 'h-10 w-10 text-sm', icon: 18 },
  lg: { box: 'h-12 w-12 text-lg', icon: 24 },
} as const;

/** The one avatar renderer: chosen icon+tone when the user picked one,
 * otherwise their initial in a name-stable tone. `online` adds the presence
 * dot: green when online, hollow when known-offline, absent when hidden. */
export function AvatarIcon({
  name,
  icon,
  tone,
  online,
  size = 'md',
}: {
  name: string;
  icon?: string | null;
  tone?: string | null;
  online?: boolean | null;
  size?: keyof typeof SIZES;
}) {
  const dims = SIZES[size];
  const entry = AVATAR_ICONS.find((a) => a.id === icon);
  const toneClasses = AVATAR_TONES.find((t) => t.id === tone)?.classes ?? toneFor(name);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={`flex ${dims.box} items-center justify-center rounded-full font-bold uppercase ${toneClasses}`}
      >
        {entry ? <entry.Icon size={dims.icon} strokeWidth={1.9} /> : name.slice(0, 1)}
      </span>
      {online !== undefined && online !== null && (
        <span
          aria-label={online ? 'Online' : 'Offline'}
          className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface ${
            online ? 'bg-emerald-500' : 'bg-line'
          }`}
        />
      )}
    </span>
  );
}
