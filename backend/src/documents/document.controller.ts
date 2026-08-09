import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentDto } from './document.dto';
import { DocumentService } from './document.service';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('documents')
@UseGuards(WebAuthGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentIngestionService: DocumentIngestionService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /pdf/ }),
        ],
      }),
    )
    file: any,
  ): Promise<DocumentDto> {
    const userId = req.user.id;

    const storageDir = process.env.DOCUMENT_STORAGE_PATH || './data/documents';
    await fs.promises.mkdir(storageDir, { recursive: true });

    const storedFilename = `${crypto.randomUUID()}.pdf`;
    const filePath = path.join(storageDir, storedFilename);
    await fs.promises.writeFile(filePath, file.buffer);

    return this.documentIngestionService.ingest(userId, filePath, file.originalname);
  }

  @Get()
  async listDocuments(@Req() req: any): Promise<DocumentDto[]> {
    return this.documentService.listDocuments(req.user.id);
  }

  @Get(':id')
  async getDocument(@Req() req: any, @Param('id') id: string): Promise<DocumentDto> {
    return this.documentService.getDocument(req.user.id, id);
  }

  @Delete(':id')
  async deleteDocument(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    return this.documentService.deleteDocument(req.user.id, id);
  }
}
