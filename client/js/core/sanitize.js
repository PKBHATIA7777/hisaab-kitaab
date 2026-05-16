/* client/js/core/sanitize.js */
/**
 * Minimal DOM-based sanitizer for user-generated content.
 * Uses the browser's own HTML parser — no library needed.
 * Returns text that is safe to use in innerHTML contexts.
 */
function escapeHTML(str) {
  if (!str || typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
  // Converts: < → &lt;  > → &gt;  & → &amp;  " → &quot;  ' → &#x27;
}

// Use this for any user-generated string placed inside innerHTML templates
window.escapeHTML = escapeHTML;