import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentDto } from './document.dto';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(
    userId: string,
    filename: string,
    mimeType: string,
    fileSize: number,
    title?: string,
  ): Promise<DocumentDto> {
    const doc = await this.prisma.document.create({
      data: { userId, filename, mimeType, fileSize, title },
    });
    return this.toDto(doc);
  }

  async getDocument(userId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, userId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.toDto(doc);
  }

  async listDocuments(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map(this.toDto);
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, userId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.documentChunk.deleteMany({ where: { documentId } });
    await this.prisma.document.delete({ where: { id: documentId } });
    return { success: true };
  }

  private toDto(doc: any): DocumentDto {
    return {
      id: doc.id,
      userId: doc.userId,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      title: doc.title,
      status: doc.status,
      pageCount: doc.pageCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as DocumentDto;
  }
}
