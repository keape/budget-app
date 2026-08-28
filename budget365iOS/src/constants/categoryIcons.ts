// Set curato di emoji selezionabili come icona categoria (spese/entrate)
export const CATEGORY_ICON_CHOICES: string[] = [
  '🏖️', '🏠', '⚽', '🎁', '🍔', '🛒', '🚗', '⛽',
  '💊', '🏥', '🎓', '📚', '💡', '📱', '🎮', '🎬',
  '✈️', '🐾', '👕', '💇', '🏋️', '🎵', '☕', '🍺',
  '💰', '💳', '📈', '🏦', '💼', '🎂', '🛠️', '🧾',
];

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emojiKeywords: Record<string, string[]> = require('emojilib');
const EMOJI_ENTRIES: [string, string[]][] = Object.entries(emojiKeywords);

// Cerca emoji per parola chiave (nome, sinonimi) nella libreria emojilib
export const searchEmoji = (query: string, limit = 32): string[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: string[] = [];
  for (const [emoji, keywords] of EMOJI_ENTRIES) {
    if (keywords.some(k => k.toLowerCase().includes(q))) {
      results.push(emoji);
      if (results.length >= limit) break;
    }
  }
  return results;
};
