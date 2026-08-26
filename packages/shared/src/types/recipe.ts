import type { Food } from './nutrition';

/** A recipe ingredient frozen for sharing: the amount plus a full food
 * snapshot, so an importer's device can rebuild it with zero lookups. */
export interface SharedRecipeIngredient {
  grams: number;
  food: Omit<Food, 'id'>;
}

export interface SharedRecipePayload {
  instructions: string | null;
  ingredients: SharedRecipeIngredient[];
}

/** Browse-card shape for the community recipe browser. */
export interface SharedRecipeCard {
  id: string;
  name: string;
  description: string;
  author: string | null;
  servings: number;
  kcalPerServing: number;
  avgRating: number | null;
  reviewCount: number;
  updatedAt: string;
  mine: boolean;
}

export interface SharedRecipeReview {
  id: string;
  username: string | null;
  rating: number;
  comment: string;
  updatedAt: string;
}

export interface SharedRecipeDetail extends SharedRecipeCard {
  payload: SharedRecipePayload;
  reviews: SharedRecipeReview[];
  myReview: { rating: number; comment: string } | null;
}
