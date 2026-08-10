/**
 * Normalizes AI-generated Markdown into clean, readable plain text for Telegram delivery.
 * Omits parse_mode to prevent Telegram entity parsing 400 Bad Request errors.
 */
export function normalizeTelegramText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let output = text;

  // 1. Convert Markdown links: [Label](URL) -> Label (URL)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const cleanLabel = label.trim();
    const cleanUrl = url.trim();
    if (!cleanLabel || cleanLabel === cleanUrl) {
      return cleanUrl;
    }
    return `${cleanLabel} (${cleanUrl})`;
  });

  // 2. Remove code block fences ```lang ... ``` or ``` ... ```
  output = output.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, '$1');

  // 3. Remove inline backticks `code` -> code
  output = output.replace(/`([^`]+)`/g, '$1');

  // 4. Remove strikethrough ~~text~~ -> text
  output = output.replace(/~~([^~]+)~~/g, '$1');

  // 5. Remove bold markers **text** or __text__ -> text
  output = output.replace(/\*\*([^*]+)\*\*/g, '$1');
  output = output.replace(/__([^_]+)__/g, '$1');

  // 6. Remove italic markers *text* or _text_ -> text
  output = output.replace(/(^|[^\w])\*([^*]+)\*([^\w]|$)/g, '$1$2$3');
  output = output.replace(/(^|[^\w])_([^_]+)_([^\w]|$)/g, '$1$2$3');

  // 7. Remove Markdown headings: # Heading, ## Heading, ### Heading
  output = output.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)/gm, '$1');

  // 8. Convert bullet list items: "- item", "* item", "+ item" -> "• item"
  output = output.replace(/^[ \t]*[-*+][ \t]+([^\n]+)/gm, '• $1');

  // 9. Clean up excessive consecutive blank lines (more than 2 consecutive newlines)
  output = output.replace(/\n{3,}/g, '\n\n');

  return output.trim();
}
