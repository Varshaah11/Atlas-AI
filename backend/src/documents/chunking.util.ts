export interface Chunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

/**
 * Chunk each page independently.
 *
 * - chunkSize: approx. 1200 characters per chunk
 * - overlap: approx. 250 characters between successive chunks
 * - prefers line breaks and sentence boundaries (trims back to previous \n or space when possible)
 * - never returns empty chunks
 */
export function chunkDocument(
  pages: Array<{ pageNumber: number; text: string }>,
  chunkSize = 1200,
  overlap = 250,
): Chunk[] {
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  for (const { pageNumber, text } of pages) {
    if (!text) continue; // skip empty pages
    let start = 0;
    const len = text.length;
    while (start < len) {
      let end = Math.min(start + chunkSize, len);
      // Prefer to cut at a newline or whitespace boundary if possible (when not at the very end)
      if (end < len) {
        let bestEnd = end;
        while (bestEnd > start && text[bestEnd] !== '\n' && text[bestEnd] !== ' ') {
          bestEnd--;
        }
        if (bestEnd > start) {
          end = bestEnd;
        }
      }
      const raw = text.slice(start, end).trim();
      if (raw.length > 0) {
        chunks.push({
          chunkIndex: globalIndex++,
          pageNumber,
          content: raw,
        });
      }
      // Move start forward by chunkSize - overlap (but ensure progress)
      if (end === len) break; // reached end of page
      const nextStart = end - Math.min(overlap, end - start);
      start = nextStart > start ? nextStart : end; // safety guard
    }
  }

  return chunks;
}
