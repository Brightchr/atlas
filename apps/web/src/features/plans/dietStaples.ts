import type { PlanDiet } from '@arcadia/shared';
import { addNeededItem } from '@/features/shopping/repository';

/** Why each eating style pairs with a plan — shown on plan profiles. */
export const DIET_BLURBS: Record<PlanDiet, string> = {
  high_protein: 'Protein-forward eating to support the muscle this plan builds — aim ~2 g/kg.',
  calorie_deficit:
    'A modest calorie deficit pairs with this plan — the training preserves muscle while the deficit does the fat loss.',
  balanced: 'No special diet needed — balanced meals with enough protein carry this plan fine.',
  performance:
    'Carb-forward fueling: this plan is demanding, so eat to perform, not to restrict.',
};

/** Starter groceries per eating style — the concrete bridge from a plan's
 * paired diet to the shopping list. Small, opinionated, and editable once
 * they land on the list like any other item. */
export const DIET_STAPLES: Record<PlanDiet, { name: string; quantity?: string }[]> = {
  high_protein: [
    { name: 'Chicken breast', quantity: '1 kg' },
    { name: 'Eggs', quantity: '12' },
    { name: 'Greek yogurt', quantity: '1 kg' },
    { name: 'Cottage cheese', quantity: '500 g' },
    { name: 'Canned tuna', quantity: '4 cans' },
    { name: 'Whey protein', quantity: '1 tub' },
  ],
  calorie_deficit: [
    { name: 'Mixed salad greens', quantity: '2 bags' },
    { name: 'Chicken breast', quantity: '500 g' },
    { name: 'Broccoli', quantity: '500 g' },
    { name: 'Berries', quantity: '500 g' },
    { name: 'Eggs', quantity: '12' },
    { name: 'Zero-calorie sparkling water', quantity: '6' },
  ],
  balanced: [
    { name: 'Oats', quantity: '1 kg' },
    { name: 'Brown rice', quantity: '1 kg' },
    { name: 'Chicken thighs', quantity: '1 kg' },
    { name: 'Mixed vegetables', quantity: '1 kg' },
    { name: 'Bananas', quantity: '6' },
    { name: 'Olive oil', quantity: '1 bottle' },
  ],
  performance: [
    { name: 'White rice', quantity: '2 kg' },
    { name: 'Pasta', quantity: '1 kg' },
    { name: 'Lean ground beef', quantity: '1 kg' },
    { name: 'Bananas', quantity: '8' },
    { name: 'Honey', quantity: '1 jar' },
    { name: 'Electrolyte mix', quantity: '1 pack' },
  ],
};

/** Adds the staples for a diet onto the (single, living) shopping list.
 * Quantities merge with anything already there. Returns how many items. */
export async function addDietStaplesToShoppingList(diet: PlanDiet): Promise<number> {
  const staples = DIET_STAPLES[diet];
  for (const item of staples) {
    await addNeededItem(item.name, item.quantity ?? null);
  }
  return staples.length;
}
