import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '@/telegram/telegram.service';
import { CONVERSATION_GATEWAY_TOKEN } from '@/chat/interfaces/conversation-gateway.interface';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';
import { DocumentIngestionService } from '@/documents/document-ingestion.service';
import { AppLogger } from '@/common/logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';

describe('TelegramService (PDF Upload & Messaging)', () => {
  let telegramService: TelegramService;
  let conversationGatewayMock: any;
  let userServiceMock: any;
  let documentIngestionServiceMock: any;
  let configServiceMock: any;
  let loggerMock: any;
  const testStorageDir = path.join(__dirname, 'test_storage_dir');

  beforeEach(async () => {
    conversationGatewayMock = {
      handleIncomingMessage: jest.fn().mockResolvedValue('Response from gateway'),
    };

    userServiceMock = {
      getOrCreateUser: jest.fn().mockResolvedValue({
        id: 'db-user-uuid-123',
        telegramId: 'telegram-user-99',
      }),
    };

    documentIngestionServiceMock = {
      ingest: jest.fn().mockResolvedValue({ id: 'doc-1', status: 'READY' }),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'DOCUMENT_MAX_FILE_SIZE_MB') return '10';
        if (key === 'DOCUMENT_STORAGE_PATH') return testStorageDir;
        return null;
      }),
    };

    loggerMock = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    // Global fetch mock for file downloading
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 sample content')),
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: CONVERSATION_GATEWAY_TOKEN, useValue: conversationGatewayMock },
        { provide: USER_SERVICE_TOKEN, useValue: userServiceMock },
        { provide: DocumentIngestionService, useValue: documentIngestionServiceMock },
        { provide: AppLogger, useValue: loggerMock },
      ],
    }).compile();

    telegramService = module.get<TelegramService>(TelegramService);
  });

  afterAll(async () => {
    await fs.promises.rm(testStorageDir, { recursive: true, force: true });
  });

  describe('Text Message Handling', () => {
    it('existing text-message handling remains unaffected', async () => {
      const ctx = {
        from: { id: 12345, username: 'johndoe', first_name: 'John', last_name: 'Doe' },
        message: { text: 'What is Apple stock price?' },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleTextMessage(ctx);

      expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(conversationGatewayMock.handleIncomingMessage).toHaveBeenCalledWith({
        userData: {
          telegramId: '12345',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
        },
        messageText: 'What is Apple stock price?',
      });
      expect(ctx.reply).toHaveBeenCalledWith('Response from gateway');
    });
  });

  describe('Document Message Handling', () => {
    it('rejects non-PDF files with a clear message', async () => {
      const ctx = {
        from: { id: 12345 },
        message: {
          document: {
            file_id: 'file-doc-1',
            mime_type: 'image/png',
            file_size: 1024,
            file_name: 'image.png',
          },
        },
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleDocumentMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Only PDF documents are supported. Please upload a PDF file.',
      );
      expect(documentIngestionServiceMock.ingest).not.toHaveBeenCalled();
    });

    it('rejects oversized PDFs with a clear message', async () => {
      const ctx = {
        from: { id: 12345 },
        message: {
          document: {
            file_id: 'file-huge',
            mime_type: 'application/pdf',
            file_size: 15 * 1024 * 1024, // 15 MB > 10 MB limit
            file_name: 'huge.pdf',
          },
        },
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleDocumentMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('❌ File exceeds the maximum allowed size of 10MB.');
      expect(documentIngestionServiceMock.ingest).not.toHaveBeenCalled();
    });

    it('propagates correct userId resolved from UserService to ingestion', async () => {
      const ctx = {
        from: { id: 999, username: 'alex', first_name: 'Alex', last_name: 'Smith' },
        message: {
          document: {
            file_id: 'file-valid-pdf',
            mime_type: 'application/pdf',
            file_size: 2 * 1024 * 1024,
            file_name: 'quarterly_report.pdf',
          },
        },
        telegram: {
          getFileLink: jest.fn().mockResolvedValue({ href: 'https://api.telegram.org/file.pdf' }),
        },
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleDocumentMessage(ctx);

      expect(userServiceMock.getOrCreateUser).toHaveBeenCalledWith({
        telegramId: '999',
        username: 'alex',
        firstName: 'Alex',
        lastName: 'Smith',
      });

      expect(ctx.reply).toHaveBeenCalledWith(
        "📄 I received your document. I'm processing it now.",
      );

      // Allow background async task to execute
      await new Promise((resolve) => setImmediate(resolve));

      expect(documentIngestionServiceMock.ingest).toHaveBeenCalledWith(
        'db-user-uuid-123',
        expect.stringMatching(/\.pdf$/),
        'quarterly_report.pdf',
      );
    });

    it('sends success message on successful ingestion', async () => {
      const ctx = {
        from: { id: 555 },
        message: {
          document: {
            file_id: 'file-pdf-success',
            mime_type: 'application/pdf',
            file_size: 1000,
            file_name: 'annual_report.pdf',
          },
        },
        telegram: {
          getFileLink: jest.fn().mockResolvedValue({ href: 'https://api.telegram.org/file.pdf' }),
        },
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleDocumentMessage(ctx);

      // Immediate response
      expect(ctx.reply).toHaveBeenCalledWith(
        "📄 I received your document. I'm processing it now.",
      );

      // Wait for background async IIFE
      await new Promise((resolve) => setImmediate(resolve));

      expect(ctx.reply).toHaveBeenCalledWith(
        '✅ Your document is ready. You can now ask questions about it.',
      );
    });

    it('sends error message on failed ingestion', async () => {
      documentIngestionServiceMock.ingest.mockRejectedValueOnce(
        new Error('No extractable text found'),
      );

      const ctx = {
        from: { id: 777 },
        message: {
          document: {
            file_id: 'file-scanned-pdf',
            mime_type: 'application/pdf',
            file_size: 2000,
            file_name: 'scanned.pdf',
          },
        },
        telegram: {
          getFileLink: jest.fn().mockResolvedValue({ href: 'https://api.telegram.org/file.pdf' }),
        },
        reply: jest.fn().mockResolvedValue(true),
      };

      await telegramService.handleDocumentMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "📄 I received your document. I'm processing it now.",
      );

      // Wait for background async IIFE
      await new Promise((resolve) => setImmediate(resolve));

      expect(ctx.reply).toHaveBeenCalledWith(
        "❌ I couldn't process that PDF. Please make sure it contains readable text.",
      );
    });
  });

  describe('Outbound Notification Handling (sendNotification)', () => {
    it('Test 1 — successful notification: passes correct parameters and returns true', async () => {
      const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 999 });
      (telegramService as any).bot = {
        telegram: {
          sendMessage: mockSendMessage,
        },
      };

      const result = await telegramService.sendNotification('telegram-user-123', 'AAPL price reached $200');

      expect(result).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(
        'telegram-user-123',
        'AAPL price reached $200',
        { parse_mode: 'Markdown' },
      );
    });

    it('Test 2 — Telegram API failure: catches error, logs failure, and returns false without throwing', async () => {
      const mockSendMessage = jest.fn().mockRejectedValue(new Error('Forbidden: bot was blocked by the user'));
      (telegramService as any).bot = {
        telegram: {
          sendMessage: mockSendMessage,
        },
      };

      const result = await telegramService.sendNotification('telegram-user-blocked', 'Market alert');

      expect(result).toBe(false);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send Telegram notification to user telegram-user-blocked'),
        expect.anything(),
        'TelegramService',
      );
    });

    it('Test 2b — Markdown parsing failure: retries with plain text fallback successfully', async () => {
      const mockSendMessage = jest.fn()
        .mockRejectedValueOnce(new Error('Bad Request: can\'t parse entities'))
        .mockResolvedValueOnce({ message_id: 1000 });

      (telegramService as any).bot = {
        telegram: {
          sendMessage: mockSendMessage,
        },
      };

      const result = await telegramService.sendNotification('telegram-user-123', 'Special text * _ $100');

      expect(result).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenLastCalledWith('telegram-user-123', 'Special text * _ $100');
    });

    it('Test 3 — empty/invalid Telegram ID or text: handles safely and returns false', async () => {
      const mockSendMessage = jest.fn();
      (telegramService as any).bot = {
        telegram: {
          sendMessage: mockSendMessage,
        },
      };

      expect(await telegramService.sendNotification('', 'Hello')).toBe(false);
      expect(await telegramService.sendNotification('   ', 'Hello')).toBe(false);
      expect(await telegramService.sendNotification('123', '')).toBe(false);
      expect(await telegramService.sendNotification(null as any, 'Hello')).toBe(false);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('Test 3b — unconfigured bot: returns false safely without throwing', async () => {
      (telegramService as any).bot = null;
      const result = await telegramService.sendNotification('12345', 'Hello');
      expect(result).toBe(false);
    });

    it('Test 4 — synthetic web user identifier (web-...) returns false safely without calling sendMessage', async () => {
      const mockSendMessage = jest.fn();
      (telegramService as any).bot = {
        telegram: {
          sendMessage: mockSendMessage,
        },
      };

      const result = await telegramService.sendNotification('web-default-web-user', 'Alert text');

      expect(result).toBe(false);
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot send Telegram notification to synthetic web identity 'web-default-web-user'"),
        'TelegramService',
      );
    });
  });
});
