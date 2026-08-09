export const DOCUMENT_MAX_FILE_SIZE_MB = parseInt(
  process.env.DOCUMENT_MAX_FILE_SIZE_MB || '10',
  10,
);
export const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || './data/documents';
