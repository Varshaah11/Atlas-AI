import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentDto } from './document.dto';
import { DocumentService } from './document.service';

/**
 * Minimal controller for document CRUD operations. Implements the routes required for Sprint 5.
 * Actual business logic resides in DocumentService. This stub satisfies the compiler and can be
 * expanded later with proper validation, authentication guards, and DTOs.
 */
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // TODO: Replace with proper authentication/authorization logic. This is temporary scaffolding.

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /pdf/ }),
        ],
      }),
    )
    file: any,
    @Body('title') title?: string,
  ): Promise<DocumentDto> {
    // Placeholder: userId should be extracted from auth context.
    const userId = 'placeholder-user-id';
    return this.documentService.createDocument(
      userId,
      file.originalname,
      file.mimetype,
      file.size,
      title,
    );
  }

  @Get()
  async listDocuments(): Promise<DocumentDto[]> {
    const userId = 'placeholder-user-id';
    return this.documentService.listDocuments(userId);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string): Promise<DocumentDto> {
    const userId = 'placeholder-user-id';
    return this.documentService.getDocument(userId, id);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string): Promise<{ success: boolean }> {
    const userId = 'placeholder-user-id';
    return this.documentService.deleteDocument(userId, id);
  }
}
