const paragraphs = text => String(text).split(/\n+/).map(part => part.trim()).filter(Boolean);
const normalized = text => paragraphs(text).join('\n');

// Only suppress a known room-item annotation when every complete source paragraph
// already occurs in the room description. Preserve unrelated/repeated narrative.
export function isRepeatedItemDescription(text, roomDescription, itemDescriptions) {
  if (!roomDescription || !itemDescriptions.some(description => normalized(description) === normalized(text))) return false;
  const known = new Set(paragraphs(roomDescription));
  const parts = paragraphs(text);
  return parts.length > 0 && parts.every(part => known.has(part));
}
