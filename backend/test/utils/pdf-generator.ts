import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import * as path from 'path';

/**
 * Generates a simple PDF with a title and two pages of distinct text.
 * The PDF will have metadata title set to the provided title.
 */
export async function generateSamplePdf(filePath: string, title: string = 'Sample PDF Title', pageTexts?: string[]): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Use default page texts if none provided (undefined)
  const texts = pageTexts !== undefined ? pageTexts : ['This is the first page content.', 'Second page has different text.'];
  for (const txt of texts) {
    const page = pdfDoc.addPage();
    const { height: ph } = page.getSize();

    if (txt.length > 100) {
      const lines = txt.match(/.{1,60}/g) || [txt];
      let y = ph - 50;
      for (const line of lines) {
        if (y < 40) break;
        page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 12;
      }
    } else if (txt.length > 0) {
      page.drawText(txt, { x: 50, y: ph - 100, size: 24, font, color: rgb(0, 0, 0) });
    }
  }

  const pdfBytes = await pdfDoc.save();
  // Ensure directory exists
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, pdfBytes);
}
