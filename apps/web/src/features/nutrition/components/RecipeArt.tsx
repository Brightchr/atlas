import imageManifest from '../recipeImages.json';

/** Recipe imagery, in two layers:
 *  1. Real photos — `recipeImages.json` maps recipe names to bundled photo
 *     files under /assets/recipes (populated by scripts/fetch-recipe-images.mjs;
 *     empty manifest = no photos, nothing breaks).
 *  2. Deterministic "food art" fallback — a rich gradient tile with a food
 *     glyph derived from the name, so every recipe has appetizing art even
 *     offline and unphotographed. Same recipe always renders the same art. */

const IMAGES = imageManifest as Record<string, string>;

export function recipeImage(name: string): string | undefined {
  return IMAGES[name] ?? IMAGES[name.toLowerCase()];
}

const GLYPHS: [string, string[]][] = [
  ['🌮', ['taco']],
  ['🌯', ['burrito', 'wrap']],
  ['🍤', ['shrimp', 'scampi']],
  ['🐟', ['salmon', 'tuna', 'cod', 'tilapia', 'fish']],
  ['🍝', ['pasta', 'lasagna', 'bolognese', 'alfredo', 'penne', 'spaghetti']],
  ['🍲', ['soup', 'chili', 'curry', 'stew', 'shepherd']],
  ['🥘', ['stir-fry', 'skillet', 'fried rice', 'sheet pan']],
  ['🥩', ['steak', 'beef', 'sirloin']],
  ['🍖', ['pork', 'tenderloin', 'ham']],
  ['🍗', ['chicken', 'turkey', 'thigh']],
  ['🍔', ['burger']],
  ['🍕', ['pizza']],
  ['🥪', ['sandwich', 'toast', 'club', 'quesadilla']],
  ['🥤', ['smoothie', 'shake', 'gainer']],
  ['🍳', ['omelet', 'omelette', 'scramble', 'egg', 'frittata']],
  ['🥣', ['oat', 'oatmeal', 'granola', 'muesli', 'cereal']],
  ['🥞', ['pancake', 'waffle']],
  ['🥗', ['salad', 'slaw', 'caprese', 'lettuce']],
  ['🍓', ['berry', 'strawberry', 'blueberry', 'raspberry']],
  ['🍌', ['banana']],
  ['🍎', ['apple']],
  ['🥭', ['mango']],
  ['🥑', ['avocado']],
  ['🍠', ['sweet potato']],
  ['🥔', ['potato']],
  ['🥜', ['peanut', 'almond', 'nut', 'trail']],
  ['🫘', ['bean', 'lentil', 'chickpea', 'hummus', 'edamame', 'tofu']],
  ['🥦', ['broccoli', 'brussels', 'asparagus', 'zucchini', 'cauliflower', 'veggie', 'cabbage', 'spinach', 'pepper', 'greens']],
  ['🧀', ['cheese', 'halloumi', 'feta', 'ricotta', 'cottage']],
  ['🍫', ['chocolate']],
  ['🍚', ['rice', 'quinoa', 'bowl']],
  ['🥛', ['yogurt', 'protein']],
];

export function foodGlyph(name: string): string {
  const lower = name.toLowerCase();
  for (const [glyph, words] of GLYPHS) {
    if (words.some((w) => lower.includes(w))) return glyph;
  }
  return '🥘';
}

/** Appetizing gradient pairs — hashed from the name so art is stable. */
const PALETTES: [string, string][] = [
  ['#f97316', '#fbbf24'], // orange → amber
  ['#ef4444', '#f97316'], // tomato → orange
  ['#84cc16', '#22c55e'], // lime → green
  ['#10b981', '#84cc16'], // emerald → lime
  ['#f43f5e', '#a855f7'], // berry
  ['#eab308', '#f97316'], // golden
  ['#14b8a6', '#84cc16'], // teal → lime
  ['#fb7185', '#fbbf24'], // peach
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function recipeArtBackground(name: string): string {
  const [from, to] = PALETTES[hash(name.toLowerCase()) % PALETTES.length]!;
  return [
    'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.4), transparent 55%)',
    `linear-gradient(135deg, ${from}cc, ${to}99)`,
  ].join(', ');
}

/** One art tile: real photo when the manifest has one, gradient+glyph
 * otherwise. Fills its container. */
function ArtFill({ name, glyphClass }: { name: string; glyphClass: string }) {
  const src = recipeImage(name);
  if (src) {
    return <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />;
  }
  return (
    <span
      style={{ background: recipeArtBackground(name) }}
      className={`flex h-full w-full items-center justify-center ${glyphClass}`}
    >
      <span className="drop-shadow-sm">{foodGlyph(name)}</span>
    </span>
  );
}

/** Square thumbnail — meal rows, selection trays. */
export function RecipeThumb({
  name,
  className = 'h-12 w-12 rounded-xl text-xl',
}: {
  name: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={`block shrink-0 overflow-hidden ${className}`}>
      <ArtFill name={name} glyphClass="text-[1em]" />
    </span>
  );
}

/** Standalone hero panel for a recipe's own page. */
export function RecipeHero({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="h-28 overflow-hidden rounded-2xl border border-line text-5xl shadow-sm md:h-36"
    >
      <ArtFill name={name} glyphClass="text-[1em]" />
    </div>
  );
}

/** Full-bleed banner across the top of a `p-4` card — the catalogue look,
 * matching the training explore cards. */
export function RecipeBanner({ name, height = 'h-24' }: { name: string; height?: string }) {
  return (
    <div
      aria-hidden
      className={`-mx-4 -mt-4 mb-3 ${height} overflow-hidden rounded-t-2xl text-4xl`}
    >
      <ArtFill name={name} glyphClass="text-[1em]" />
    </div>
  );
}

/** A strip of art tiles for a set of recipe names — meal-plan cards and
 * heroes. Negative margins are the caller's job (varies with card padding). */
export function NamesArtStrip({
  names,
  className = 'h-16 rounded-t-2xl',
}: {
  names: string[];
  className?: string;
}) {
  return (
    <div aria-hidden className={`flex gap-px overflow-hidden text-2xl ${className}`}>
      {names.map((name) => (
        <span key={name} className="min-w-0 flex-1 overflow-hidden">
          <ArtFill name={name} glyphClass="text-[1em]" />
        </span>
      ))}
    </div>
  );
}
