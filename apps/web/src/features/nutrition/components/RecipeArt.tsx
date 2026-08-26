/** Deterministic "food photo" stand-ins: recipes have no imagery, so every
 * recipe gets a rich gradient tile with a food glyph derived from its name.
 * The same recipe always renders the same art, at thumbnail or banner size —
 * the app's answer to the photo-first look of big meal-plan apps. */

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

/** Square thumbnail — meal rows, selection trays. */
export function RecipeThumb({ name, className = 'h-12 w-12' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: recipeArtBackground(name) }}
      className={`flex shrink-0 items-center justify-center rounded-xl text-xl ${className}`}
    >
      <span className="drop-shadow-sm">{foodGlyph(name)}</span>
    </span>
  );
}

/** Standalone hero panel for a recipe's own page. */
export function RecipeHero({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      style={{ background: recipeArtBackground(name) }}
      className="flex h-28 items-center justify-center rounded-2xl border border-line shadow-sm"
    >
      <span className="text-5xl drop-shadow-md">{foodGlyph(name)}</span>
    </div>
  );
}

/** Full-bleed banner across the top of a `p-4` card — the catalogue look,
 * matching the training explore cards. */
export function RecipeBanner({ name, height = 'h-24' }: { name: string; height?: string }) {
  return (
    <div
      aria-hidden
      style={{ background: recipeArtBackground(name) }}
      className={`-mx-4 -mt-4 mb-3 flex ${height} items-center justify-center overflow-hidden rounded-t-2xl`}
    >
      <span className="text-4xl drop-shadow-md">{foodGlyph(name)}</span>
    </div>
  );
}
