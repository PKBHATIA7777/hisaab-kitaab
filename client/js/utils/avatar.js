/**
 * Avatar utilities — single source of truth.
 * Replaces the two separate implementations in dashboard.js and chapter.js.
 */

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24',
  '#F0932B', '#6C5CE7', '#A29BFE', '#00B894',
  '#E17055', '#D63031', '#74B9FF', '#55EFC4',
  '#FDCB6E', '#E84393', '#636E72',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Render an avatar element string for use in innerHTML
function renderAvatar(name, { size = 'md', extra = '' } = {}) {
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  return `<div class="avatar avatar--${size}" style="background:${color}" aria-label="${escapeHTML(name)}">${initials}</div>`;
}

window.getAvatarColor  = getAvatarColor;
window.getInitials     = getInitials;
window.renderAvatar    = renderAvatar;