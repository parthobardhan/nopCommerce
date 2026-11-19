import type { Category } from '../api/types';

export function findCategory(categories: Category[], id: number): Category | null {
  for (const category of categories) {
    if (category.id === id) return category;
    const found = findCategory(category.subCategories, id);
    if (found) return found;
  }
  return null;
}
