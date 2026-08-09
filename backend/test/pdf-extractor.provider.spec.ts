import { PdfExtractorProvider, PdfExtractionError } from '@/documents/pdf-extractor.provider';
import { generateSamplePdf } from './utils/pdf-generator';
import { writeFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';

describe('PdfExtractorProvider', () => {
  const provider = new PdfExtractorProvider({ error: () => {}, warn: () => {}, info: () => {}, debug: () => {} } as any);
  const fixturesDir = join(__dirname, 'fixtures_pdf_extractor');
  const samplePdfPath = join(fixturesDir, 'sample.pdf');

  beforeAll(async () => {
    await rm(fixturesDir, { recursive: true, force: true });
    await mkdir(fixturesDir, { recursive: true }); // ensure dir exists
    await generateSamplePdf(samplePdfPath, 'Test PDF Title');
  });

  afterAll(async () => {
    await rm(fixturesDir, { recursive: true, force: true });
  });

  it('successfully extracts title, pageCount and pages', async () => {
    const result = await provider.extract(samplePdfPath);
    expect(result.title).toBe('Test PDF Title');
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[0].text).toContain('This is the first page content');
    expect(result.pages[1].text).toContain('Second page has different text');
  });

  it('throws PdfExtractionError for nonexistent file', async () => {
    await expect(provider.extract('nonexistent.pdf')).rejects.toBeInstanceOf(PdfExtractionError);
  });

  it('throws PdfExtractionError for empty file', async () => {
    const emptyPath = join(fixturesDir, 'empty.pdf');
    await writeFile(emptyPath, '');
    await expect(provider.extract(emptyPath)).rejects.toBeInstanceOf(PdfExtractionError);
  });

  it('throws PdfExtractionError for malformed file', async () => {
    const badPath = join(fixturesDir, 'bad.pdf');
    await writeFile(badPath, 'not a pdf');
    await expect(provider.extract(badPath)).rejects.toBeInstanceOf(PdfExtractionError);
  });
});
