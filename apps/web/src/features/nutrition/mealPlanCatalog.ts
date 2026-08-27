import type { MealType } from '@arcadia/shared';

/** Starter meal plans. A template is a repeating Monday–Sunday week — run it
 * as long as the phase lasts (the Comeback plan is written for 6 months).
 *
 * Most templates define per-meal POOLS and the week rotates through them for
 * variety; a template with explicit `days` (the Comeback) controls every
 * slot. All recipes referenced here live in the bundled recipe catalog, so
 * applying a plan works offline and imports any recipes you don't have yet. */

export interface TemplateSlot {
  recipe: string;
  servings?: number;
}

export interface MealPlanTemplate {
  key: string;
  name: string;
  tagline: string;
  goal: 'lose' | 'gain' | 'maintain';
  style: string[];
  kcalPerDay: number;
  proteinPerDay: number;
  note?: string;
  pools: Record<MealType, TemplateSlot[]>;
  /** 7 explicit days (Monday-first); overrides pool rotation. */
  days?: Record<MealType, TemplateSlot[]>[];
}

const s = (recipe: string, servings?: number): TemplateSlot =>
  servings ? { recipe, servings } : { recipe };

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** What a template serves on one day (0 = Monday): explicit `days` verbatim,
 * otherwise the pools rotated by weekday — the same resolution the apply
 * flow uses, so previews match what actually lands in the week. */
export function templateSlotsForDay(
  template: MealPlanTemplate,
  day: number,
): Record<MealType, TemplateSlot[]> {
  if (template.days) return template.days[day]!;
  const out = {} as Record<MealType, TemplateSlot[]>;
  for (const meal of ALL_MEALS) {
    const pool = template.pools[meal];
    out[meal] = pool.length > 0 ? [pool[day % pool.length]!] : [];
  }
  return out;
}

/** The three recipes that give a template its face — its first breakfast,
 * lunch and dinner. Drives the art strips on cards and heroes. */
export function templateArtNames(template: MealPlanTemplate): string[] {
  const names: string[] = [];
  const first = templateSlotsForDay(template, 0);
  for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
    const name = first[meal][0]?.recipe;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export const MEAL_PLAN_TEMPLATES: MealPlanTemplate[] = [
  /* ------------------------------ Weight loss ------------------------------ */
  {
    key: 'kickstart-1500',
    name: 'Kickstart Cut',
    tagline: 'A gentle first cut — filling meals, simple prep.',
    goal: 'lose',
    style: ['High protein', 'Beginner'],
    kcalPerDay: 1500,
    proteinPerDay: 120,
    pools: {
      breakfast: [s('Greek Yogurt Berry Bowl'), s('Egg White Veggie Scramble'), s('Blueberry Protein Smoothie')],
      lunch: [s('Tuna Salad Lettuce Wraps'), s('Cottage Cheese Veggie Plate'), s('Chicken Vegetable Soup')],
      dinner: [s('Baked Salmon with Asparagus'), s('Garlic Butter Cod with Green Beans'), s('Turkey Taco Skillet')],
      snack: [s('Protein Yogurt Cup'), s('Cottage Cheese with Berries'), s('Chocolate Yogurt Bark')],
    },
  },
  {
    key: 'lean-cut-1700',
    name: 'Lean Cut',
    tagline: 'The high-protein default cut: never hungry, always simple.',
    goal: 'lose',
    style: ['High protein'],
    kcalPerDay: 1700,
    proteinPerDay: 150,
    pools: {
      breakfast: [s('Spinach and Pepper Omelet'), s('Greek Yogurt Berry Bowl'), s('Smoked Salmon Breakfast Plate')],
      lunch: [s('Grilled Chicken Power Salad'), s('Tuna Salad Lettuce Wraps'), s('Chicken Caesar-ish Salad')],
      dinner: [s('Garlic Butter Cod with Green Beans'), s('Chicken Stir-Fry'), s('Turkey Meatballs in Marinara')],
      snack: [s('Cottage Cheese with Berries'), s('Protein Yogurt Cup'), s('Turkey Roll-Ups')],
    },
  },
  {
    key: 'low-carb-cut-1600',
    name: 'Low-Carb Cut',
    tagline: 'Carbs from vegetables only — steaks, fish, eggs, greens.',
    goal: 'lose',
    style: ['Low carb', 'High protein'],
    kcalPerDay: 1600,
    proteinPerDay: 150,
    pools: {
      breakfast: [s('Spinach and Pepper Omelet'), s('Tofu Scramble'), s('Smoked Salmon Breakfast Plate')],
      lunch: [s('Shrimp Zoodle Bowl'), s('Steak Salad with Avocado'), s('Tuna Salad Lettuce Wraps')],
      dinner: [s('Sirloin with Roasted Brussels'), s('Baked Salmon with Asparagus'), s('Shrimp Cauliflower Fried Rice')],
      snack: [s('Hard-Boiled Egg Pack'), s('Turkey Roll-Ups'), s('Cottage Cheese with Berries')],
    },
  },
  {
    key: 'veg-cut-1600',
    name: 'Vegetarian Cut',
    tagline: 'Plants, eggs and dairy doing the cutting.',
    goal: 'lose',
    style: ['Vegetarian', 'High fiber'],
    kcalPerDay: 1600,
    proteinPerDay: 100,
    pools: {
      breakfast: [s('Ricotta Berry Breakfast Bowl'), s('Tofu Scramble'), s('Greek Yogurt Berry Bowl')],
      lunch: [s('Mediterranean Chickpea Salad'), s('Lentil Soup with Greens'), s('Cottage Cheese Veggie Plate')],
      dinner: [s('Tofu Veggie Stir-Fry'), s('Zucchini Lasagna'), s('Chickpea Curry')],
      snack: [s('Hummus Veggie Plate'), s('Edamame with Sea Salt'), s('Apple with Peanut Butter')],
    },
  },
  {
    key: 'mediterranean-1800',
    name: 'Mediterranean Cut',
    tagline: 'Olive oil, fish, legumes — the pattern with the evidence.',
    goal: 'lose',
    style: ['Mediterranean', 'High fiber'],
    kcalPerDay: 1800,
    proteinPerDay: 120,
    pools: {
      breakfast: [s('Greek Yogurt Berry Bowl'), s('Ricotta Berry Breakfast Bowl'), s('Spinach and Pepper Omelet')],
      lunch: [s('Mediterranean Chickpea Salad'), s('Greek Chicken Bowl'), s('Lentil Soup with Greens')],
      dinner: [s('Baked Salmon with Asparagus'), s('Baked Tilapia with Rice Pilaf'), s('Halloumi-Style Feta Sheet Pan')],
      snack: [s('Hummus Veggie Plate'), s('Cheese and Apple Plate'), s('Cottage Cheese with Berries')],
    },
  },
  {
    key: 'aggressive-1400',
    name: 'Aggressive Cut',
    tagline: 'Short, sharp deficit — maximum protein per calorie.',
    goal: 'lose',
    style: ['High protein', 'Low carb'],
    kcalPerDay: 1400,
    proteinPerDay: 140,
    note: 'Run for 6–8 weeks at most, then return to a moderate deficit.',
    pools: {
      breakfast: [s('Egg White Veggie Scramble'), s('Protein Yogurt Cup'), s('Greek Yogurt Berry Bowl')],
      lunch: [s('Tuna Salad Lettuce Wraps'), s('Shrimp Zoodle Bowl'), s('Chicken Vegetable Soup')],
      dinner: [s('Garlic Butter Cod with Green Beans'), s('Turkey Taco Skillet'), s('Chicken Stir-Fry')],
      snack: [s('Hard-Boiled Egg Pack'), s('Cottage Cheese with Berries'), s('Protein Yogurt Cup')],
    },
  },
  {
    key: 'high-fiber-1700',
    name: 'High-Fiber Cut',
    tagline: 'Beans, lentils and vegetables — fullness by volume.',
    goal: 'lose',
    style: ['High fiber'],
    kcalPerDay: 1700,
    proteinPerDay: 110,
    pools: {
      breakfast: [s('Protein Overnight Oats'), s('Greek Yogurt Berry Bowl'), s('Banana Protein Oatmeal')],
      lunch: [s('Lentil Soup with Greens'), s('Mediterranean Chickpea Salad'), s('Chicken Burrito Bowl')],
      dinner: [s('Turkey Chili'), s('Lentil Bolognese'), s('Bean and Cheese Stuffed Sweet Potato')],
      snack: [s('Hummus Veggie Plate'), s('Edamame with Sea Salt'), s('Apple with Peanut Butter')],
    },
  },
  {
    key: 'pescatarian-1700',
    name: 'Pescatarian Cut',
    tagline: 'Fish-first fat loss.',
    goal: 'lose',
    style: ['Pescatarian', 'High protein'],
    kcalPerDay: 1700,
    proteinPerDay: 140,
    pools: {
      breakfast: [s('Smoked Salmon Breakfast Plate'), s('Greek Yogurt Berry Bowl'), s('Salmon Avocado Toast')],
      lunch: [s('Tuna Salad Lettuce Wraps'), s('Shrimp Zoodle Bowl'), s('Tuna Cucumber Bites', 1.5)],
      dinner: [s('Baked Salmon with Asparagus'), s('Baja Cod Tacos'), s('Shrimp Cauliflower Fried Rice')],
      snack: [s('Cottage Cheese with Berries'), s('Edamame with Sea Salt'), s('Protein Yogurt Cup')],
    },
  },
  {
    key: 'big-cut-2200',
    name: 'Big Frame Cut',
    tagline: 'A deficit for bigger bodies — 2,200 kcal that eats like more.',
    goal: 'lose',
    style: ['High protein'],
    kcalPerDay: 2200,
    proteinPerDay: 180,
    pools: {
      breakfast: [s('Spinach and Pepper Omelet'), s('Protein Overnight Oats'), s('Smoked Salmon Breakfast Plate')],
      lunch: [s('Grilled Chicken Power Salad'), s('Steak Salad with Avocado'), s('Chicken Caesar-ish Salad')],
      dinner: [s('Sirloin with Roasted Brussels'), s('Chicken Parmesan Bake'), s('Beef and Broccoli')],
      snack: [s('Blueberry Protein Smoothie'), s('Cottage Cheese Power Bowl'), s('Greek Yogurt Berry Bowl')],
    },
  },
  {
    key: 'athlete-cut-2000',
    name: 'Athlete Cut',
    tagline: 'Cutting while training hard — carbs stay near the work.',
    goal: 'lose',
    style: ['High protein', 'Performance'],
    kcalPerDay: 2000,
    proteinPerDay: 170,
    pools: {
      breakfast: [s('Banana Protein Oatmeal'), s('Protein Overnight Oats'), s('Spinach and Pepper Omelet')],
      lunch: [s('Chicken Avocado Bowl'), s('Greek Chicken Bowl'), s('Chicken Burrito Bowl')],
      dinner: [s('Chicken Stir-Fry'), s('Baked Tilapia with Rice Pilaf'), s('Turkey Meatballs in Marinara')],
      snack: [s('Chocolate Recovery Shake'), s('Protein Yogurt Cup'), s('Cottage Cheese with Berries')],
    },
  },
  /* ------------------------------ Weight gain ------------------------------ */
  {
    key: 'lean-bulk-2800',
    name: 'Lean Bulk',
    tagline: 'A surplus with brakes: muscle first, minimal spillover.',
    goal: 'gain',
    style: ['High protein'],
    kcalPerDay: 2800,
    proteinPerDay: 180,
    pools: {
      breakfast: [s('Banana Protein Oatmeal'), s('Peanut Butter Banana Toast'), s('Protein Overnight Oats')],
      lunch: [s('Chicken Avocado Bowl'), s('Chicken Burrito Bowl'), s('Greek Chicken Bowl')],
      dinner: [s('Salmon Rice Bowl'), s('Chicken Alfredo-ish Pasta'), s('Stuffed Bell Peppers', 1.3)],
      snack: [s('Peanut Butter Banana Shake'), s('Cottage Cheese Power Bowl'), s('Trail Fuel Mix')],
    },
  },
  {
    key: 'classic-bulk-3200',
    name: 'Classic Bulk',
    tagline: 'Rice, pasta, beef, shakes — the traditional off-season.',
    goal: 'gain',
    style: ['High protein', 'High calorie'],
    kcalPerDay: 3200,
    proteinPerDay: 200,
    pools: {
      breakfast: [s('Bulk Breakfast Burrito'), s('Bulk Builder Oatmeal'), s('Peanut Butter Banana Toast', 1.3)],
      lunch: [s('Big Bulk Pasta with Beef'), s('Chicken Fried Rice'), s('Loaded Baked Potato with Turkey')],
      dinner: [s('Salmon Rice Bowl'), s('Chicken Alfredo-ish Pasta'), s('Loaded Sweet Potato and Beef Skillet')],
      snack: [s('Peanut Butter Banana Shake'), s('Trail Fuel Mix'), s('PB Banana Gainer Sandwich')],
    },
  },
  {
    key: 'hardgainer-3600',
    name: 'Hardgainer 3600',
    tagline: 'For the people who "can\'t gain" — calories you can drink.',
    goal: 'gain',
    style: ['High calorie'],
    kcalPerDay: 3600,
    proteinPerDay: 200,
    note: 'The shakes are the plan. Never skip the shakes.',
    pools: {
      breakfast: [s('Bulk Builder Oatmeal'), s('Bulk Breakfast Burrito'), s('Banana Protein Oatmeal', 1.3)],
      lunch: [s('Big Bulk Pasta with Beef'), s('Chicken Fried Rice'), s('Shrimp Scampi Pasta', 1.3)],
      dinner: [s('Salmon Rice Bowl'), s('Loaded Sweet Potato and Beef Skillet'), s('Chicken Alfredo-ish Pasta')],
      snack: [s('Mass Gainer Shake'), s('Mass Gainer Shake'), s('PB Banana Gainer Sandwich')],
    },
  },
  {
    key: 'veg-bulk-2900',
    name: 'Vegetarian Bulk',
    tagline: 'Gaining on plants, dairy and eggs.',
    goal: 'gain',
    style: ['Vegetarian', 'High calorie'],
    kcalPerDay: 2900,
    proteinPerDay: 140,
    pools: {
      breakfast: [s('Bulk Builder Oatmeal'), s('Ricotta Berry Breakfast Bowl', 1.3), s('Peanut Butter Banana Toast', 1.3)],
      lunch: [s('Caprese Pasta'), s('Black Bean Quesadillas', 1.3), s('Egg Fried Quinoa')],
      dinner: [s('Lentil Bolognese', 1.3), s('Bean and Cheese Stuffed Sweet Potato', 1.3), s('Chickpea Curry', 1.3)],
      snack: [s('Mango Coconut Smoothie'), s('PB Banana Gainer Sandwich'), s('Trail Fuel Mix')],
    },
  },
  {
    key: 'athlete-3000',
    name: 'Athlete Performance',
    tagline: 'Fuel for two-a-days: carbs around training, protein all day.',
    goal: 'gain',
    style: ['Performance', 'High protein'],
    kcalPerDay: 3000,
    proteinPerDay: 190,
    pools: {
      breakfast: [s('Banana Protein Oatmeal'), s('Bulk Breakfast Burrito'), s('Protein Overnight Oats', 1.3)],
      lunch: [s('Chicken Fried Rice'), s('Chicken Avocado Bowl'), s('Greek Chicken Bowl')],
      dinner: [s('Salmon Rice Bowl'), s('Baked Tilapia with Rice Pilaf'), s('Turkey Meatballs in Marinara', 1.3)],
      snack: [s('Chocolate Recovery Shake'), s('Peanut Butter Banana Shake'), s('Rice Cakes with Almond Butter')],
    },
  },
  {
    key: 'budget-bulk-3000',
    name: 'Budget Bulk',
    tagline: 'Eggs, rice, beans, ground turkey — gains per dollar.',
    goal: 'gain',
    style: ['High calorie', 'Budget'],
    kcalPerDay: 3000,
    proteinPerDay: 170,
    pools: {
      breakfast: [s('Banana Protein Oatmeal'), s('Egg Salad Sandwich'), s('Bulk Builder Oatmeal')],
      lunch: [s('Meal-Prep Rice and Beans', 1.5), s('Loaded Baked Potato with Turkey'), s('Chicken Fried Rice')],
      dinner: [s('Turkey Chili', 1.5), s('Stuffed Bell Peppers', 1.3), s('Big Bulk Pasta with Beef')],
      snack: [s('Peanut Butter Banana Shake'), s('Apple with Peanut Butter'), s('Hard-Boiled Egg Pack')],
    },
  },
  {
    key: 'clean-bulk-2600',
    name: 'Clean Bulk',
    tagline: 'The smallest surplus that still moves the scale.',
    goal: 'gain',
    style: ['High protein'],
    kcalPerDay: 2600,
    proteinPerDay: 180,
    pools: {
      breakfast: [s('Protein Overnight Oats'), s('Spinach and Pepper Omelet'), s('Banana Protein Oatmeal')],
      lunch: [s('Chicken Avocado Bowl'), s('Greek Chicken Bowl'), s('Turkey Club Wrap')],
      dinner: [s('Salmon Rice Bowl'), s('Pork Tenderloin with Sweet Potato'), s('Chicken Parmesan Bake')],
      snack: [s('Blueberry Protein Smoothie'), s('Cottage Cheese Power Bowl'), s('Apple with Peanut Butter')],
    },
  },
  /* ------------------------------- Maintain -------------------------------- */
  {
    key: 'balanced-2200',
    name: 'Balanced Maintain',
    tagline: 'Holding steady with real food and no counting stress.',
    goal: 'maintain',
    style: ['Balanced'],
    kcalPerDay: 2200,
    proteinPerDay: 140,
    pools: {
      breakfast: [s('Protein Overnight Oats'), s('Greek Yogurt Berry Bowl'), s('Spinach and Pepper Omelet')],
      lunch: [s('Turkey Club Wrap'), s('Greek Chicken Bowl'), s('Mediterranean Chickpea Salad')],
      dinner: [s('Chicken Stir-Fry'), s('Baked Salmon with Asparagus'), s('Stuffed Bell Peppers')],
      snack: [s('Apple with Peanut Butter'), s('Cheese and Apple Plate'), s('Cottage Cheese with Berries')],
    },
  },
  {
    key: 'hp-maintain-2400',
    name: 'High-Protein Maintain',
    tagline: 'Recomposition mode: maintenance calories, lifter protein.',
    goal: 'maintain',
    style: ['High protein'],
    kcalPerDay: 2400,
    proteinPerDay: 180,
    pools: {
      breakfast: [s('Spinach and Pepper Omelet'), s('Protein Overnight Oats'), s('Smoked Salmon Breakfast Plate')],
      lunch: [s('Grilled Chicken Power Salad'), s('Chicken Avocado Bowl'), s('Steak Salad with Avocado')],
      dinner: [s('Chicken Parmesan Bake'), s('Beef and Broccoli'), s('Pork Tenderloin with Sweet Potato')],
      snack: [s('Chocolate Recovery Shake'), s('Cottage Cheese Power Bowl'), s('Protein Yogurt Cup')],
    },
  },
  {
    key: 'veg-maintain-2100',
    name: 'Vegetarian Maintain',
    tagline: 'Meat-free maintenance with protein handled.',
    goal: 'maintain',
    style: ['Vegetarian', 'High fiber'],
    kcalPerDay: 2100,
    proteinPerDay: 110,
    pools: {
      breakfast: [s('Ricotta Berry Breakfast Bowl'), s('Protein Overnight Oats'), s('Tofu Scramble')],
      lunch: [s('Tofu Buddha Bowl'), s('Mediterranean Chickpea Salad'), s('Egg Salad Sandwich')],
      dinner: [s('Lentil Bolognese'), s('Zucchini Lasagna'), s('Black Bean Quesadillas')],
      snack: [s('Apple with Peanut Butter'), s('Hummus Veggie Plate'), s('Trail Fuel Mix')],
    },
  },
  /* ------------------------------- Personal -------------------------------- */
  {
    key: 'comeback-phase1',
    name: 'Comeback Plan',
    tagline:
      'Companion to The Comeback 5-Day: ~1,750 kcal lifting days, ~1,550–1,650 fast days, ~190 g protein. No corn, no seeds, no popcorn — by construction.',
    goal: 'lose',
    style: ['High protein', 'Low carb', 'High fiber', 'No corn or seeds'],
    kcalPerDay: 1700,
    proteinPerDay: 190,
    note:
      'Run this week on repeat. Tue/Thu are fast days: breakfast at 9:00, lunch 12:30, the DINNER slot is the 3:15 pm final meal — nothing after 4 pm, 5-mile elliptical at 6:30. Lifting days: train 5:30–7, the snack slot includes the post-lift shake. Last food ≥3 h before bed, every night.',
    pools: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    },
    days: [
      {
        breakfast: [s('Egg White Veggie Scramble')],
        lunch: [s('Grilled Chicken Power Salad')],
        dinner: [s('Baked Salmon with Asparagus')],
        snack: [s('Comeback Post-Lift Shake'), s('Cottage Cheese with Berries')],
      },
      {
        breakfast: [s('Break-Fast Eggs and Salmon')],
        lunch: [s('Tuna Salad Lettuce Wraps')],
        dinner: [s('Lemon Herb Roast Chicken Thighs')],
        snack: [s('Protein Yogurt Cup')],
      },
      {
        breakfast: [s('Greek Yogurt Berry Bowl')],
        lunch: [s('Turkey Taco Skillet')],
        dinner: [s('Sirloin with Roasted Brussels')],
        snack: [s('Comeback Post-Lift Shake'), s('Hard-Boiled Egg Pack')],
      },
      {
        breakfast: [s('Break-Fast Eggs and Salmon')],
        lunch: [s('Shrimp Zoodle Bowl')],
        dinner: [s('Chicken Curry with Cauliflower')],
        snack: [s('Cottage Cheese with Berries')],
      },
      {
        breakfast: [s('Egg White Veggie Scramble')],
        lunch: [s('Chicken Caesar-ish Salad')],
        dinner: [s('Garlic Butter Cod with Green Beans')],
        snack: [s('Comeback Post-Lift Shake'), s('Greek Yogurt Berry Bowl')],
      },
      {
        breakfast: [s('Protein Overnight Oats')],
        lunch: [s('Comeback Chicken Salad Bowl')],
        dinner: [s('Zucchini Lasagna')],
        snack: [s('Protein Yogurt Cup')],
      },
      {
        breakfast: [s('Greek Yogurt Berry Bowl')],
        lunch: [s('Chicken Vegetable Soup')],
        dinner: [s('Sunday Steak and Roast Veg'), s('Herbed Cauliflower Mash')],
        snack: [s('Cottage Cheese with Berries')],
      },
    ],
  },
];
