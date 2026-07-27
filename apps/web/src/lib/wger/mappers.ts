import type { Exercise, Muscle } from '@arcadia/shared';
import type { WgerExerciseInfo, WgerMuscle } from './types';

const ENGLISH = 2;
const WGER_BASE = 'https://wger.de';

function toMuscle(m: WgerMuscle): Muscle {
  return {
    id: m.id,
    name: m.name,
    commonName: m.name_en || m.name,
    isFront: m.is_front,
  };
}

export function toExercise(info: WgerExerciseInfo): Exercise {
  const translation =
    info.translations.find((t) => t.language === ENGLISH) ?? info.translations[0];

  return {
    id: info.id,
    name: translation?.name ?? `Exercise #${info.id}`,
    description: translation?.description ?? '',
    category: info.category,
    primaryMuscles: info.muscles.map(toMuscle),
    secondaryMuscles: info.muscles_secondary.map(toMuscle),
    equipment: info.equipment,
    imageUrls: info.images
      .sort((a, b) => Number(b.is_main) - Number(a.is_main))
      .map((img) => (img.image.startsWith('http') ? img.image : `${WGER_BASE}${img.image}`)),
  };
}
