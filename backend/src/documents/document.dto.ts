export class CreateDocumentDto {
  // The original filename uploaded by the user
  originalFilename: string;

  // Optional title extracted from PDF metadata
  title?: string;

  // Optional number of pages (will be set after extraction)
  pageCount?: number;
}

export class DocumentDto {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  title?: string;
  status: string;
  pageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
