export const normalizeSearchText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getEditDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

const getAllowedTypos = (word) => {
  if (word.length <= 2) return 0;
  if (word.length <= 5) return 1;
  return 2;
};

export const getSearchMatchScore = (itemName, searchTerm) => {
  const normalizedItem = normalizeSearchText(itemName);
  const normalizedSearch = normalizeSearchText(searchTerm);

  if (!normalizedSearch) return 1;
  if (normalizedItem === normalizedSearch) return 100;
  if (normalizedItem.startsWith(normalizedSearch)) return 95;
  if (normalizedItem.includes(normalizedSearch)) return 90;

  const itemWords = normalizedItem.split(' ').filter(Boolean);
  const searchWords = normalizedSearch.split(' ').filter(Boolean);
  let totalDistance = 0;

  for (const searchWord of searchWords) {
    let bestWordScore = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const itemWord of itemWords) {
      if (itemWord === searchWord) {
        bestWordScore = 85;
        bestDistance = 0;
        break;
      }

      if (itemWord.startsWith(searchWord)) {
        bestWordScore = Math.max(bestWordScore, 80);
        bestDistance = Math.min(bestDistance, itemWord.length - searchWord.length);
        continue;
      }

      if (itemWord.includes(searchWord) && searchWord.length >= 3) {
        bestWordScore = Math.max(bestWordScore, 75);
        bestDistance = Math.min(bestDistance, itemWord.length - searchWord.length);
        continue;
      }

      const distance = getEditDistance(searchWord, itemWord);
      if (distance <= getAllowedTypos(searchWord)) {
        bestWordScore = Math.max(bestWordScore, 70 - distance);
        bestDistance = Math.min(bestDistance, distance);
      }
    }

    if (bestWordScore === 0) return 0;
    totalDistance += bestDistance;
  }

  return Math.max(1, 70 - totalDistance);
};
