import { Module } from '@nestjs/common';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentSearchService } from './document-search.service';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { EmbeddingProvider } from './embedding.provider';
import { PdfExtractorProvider } from './pdf-extractor.provider';
import { PrismaService } from '@/database/prisma.service';

@Module({
  imports: [],
  providers: [
    PrismaService,
    DocumentService,
    PdfExtractorProvider,
    DocumentIngestionService,
    DocumentSearchService,
    EmbeddingProvider,
  ],
  controllers: [DocumentController],
  exports: [DocumentService, DocumentIngestionService, DocumentSearchService, EmbeddingProvider],
})
export class DocumentModule {}
