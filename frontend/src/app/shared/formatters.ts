/**
 * Formats participant counts using natural Portuguese pluralization.
 */
export function formatParticipantCount(count: number): string {
  if (count <= 0) {
    return 'Nenhum participante ainda';
  }
  if (count === 1) {
    return '1 participante';
  }
  return `${count} participantes`;
}

/**
 * Extracts up to two uppercase initials from a participant's display name.
 */
export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_TONES = [
  'bg-pine-100 text-pine-900 border-pine-200',
  'bg-cranberry-100 text-cranberry-800 border-cranberry-200',
  'bg-gold-100 text-gold-900 border-gold-200'
] as const;

/**
 * Returns a deterministic festive color class for an avatar based on the user's name.
 */
export function getAvatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/**
 * Generates a normalized username suggestion from a display name.
 */
export function suggestUsername(rawName: string): string {
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);
}
