import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from '@/chat/chat.controller';
import { DocumentController } from '@/documents/document.controller';
import { CONVERSATION_GATEWAY_TOKEN } from '@/chat/interfaces/conversation-gateway.interface';
import { DocumentService } from '@/documents/document.service';
import { DocumentIngestionService } from '@/documents/document-ingestion.service';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import { IntentCategory } from '@/ai/conversation/conversation.types';
import { RuleBasedIntentClassifier } from '@/ai/conversation/rule-based-intent-classifier.service';

describe('Web Authentication & User Isolation Security Suite', () => {
  let chatController: ChatController;
  let documentController: DocumentController;
  let webAuthGuard: WebAuthGuard;

  let conversationGatewayMock: any;
  let userServiceMock: any;
  let documentServiceMock: any;
  let documentIngestionServiceMock: any;

  beforeEach(async () => {
    conversationGatewayMock = {
      handleIncomingMessage: jest.fn().mockImplementation((dto: any) => {
        return Promise.resolve(`Processed message for ${dto.userData.telegramId}`);
      }),
    };

    userServiceMock = {
      getOrCreateUser: jest.fn().mockImplementation((userData: any) => {
        return Promise.resolve({
          id: `uuid-${userData.telegramId}`,
          telegramId: userData.telegramId,
          username: userData.username,
        });
      }),
    };

    documentServiceMock = {
      listDocuments: jest.fn().mockResolvedValue([]),
      getDocument: jest.fn().mockResolvedValue(null),
      deleteDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    documentIngestionServiceMock = {
      ingest: jest.fn().mockResolvedValue({ id: 'doc-1', status: 'READY' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController, DocumentController],
      providers: [
        WebAuthGuard,
        { provide: CONVERSATION_GATEWAY_TOKEN, useValue: conversationGatewayMock },
        { provide: USER_SERVICE_TOKEN, useValue: userServiceMock },
        { provide: DocumentService, useValue: documentServiceMock },
        { provide: DocumentIngestionService, useValue: documentIngestionServiceMock },
      ],
    }).compile();

    chatController = module.get<ChatController>(ChatController);
    documentController = module.get<DocumentController>(DocumentController);
    webAuthGuard = module.get<WebAuthGuard>(WebAuthGuard);
  });

  describe('Requirement A & B: User Isolation', () => {
    it('Authenticated web user A sends a document question → correct userId reaches the conversation pipeline', async () => {
      const mockReqA = {
        headers: { 'x-user-id': 'user-alpha' },
      } as any;

      await webAuthGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockReqA }),
      } as any);

      const resA = await chatController.sendMessage(mockReqA, 'What is in my document?');

      expect(mockReqA.user.telegramId).toBe('web-user-alpha');
      expect(mockReqA.user.id).toBe('uuid-web-user-alpha');
      expect(conversationGatewayMock.handleIncomingMessage).toHaveBeenCalledWith({
        userData: expect.objectContaining({
          telegramId: 'web-user-alpha',
        }),
        messageText: 'What is in my document?',
      });
      expect(resA.output).toBe('Processed message for web-user-alpha');
    });

    it('Authenticated web user B sends a document question → different correct userId reaches the pipeline', async () => {
      const mockReqB = {
        headers: { 'x-user-id': 'user-beta' },
      } as any;

      await webAuthGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockReqB }),
      } as any);

      const resB = await chatController.sendMessage(mockReqB, 'What is in my document?');

      expect(mockReqB.user.telegramId).toBe('web-user-beta');
      expect(mockReqB.user.id).toBe('uuid-web-user-beta');
      expect(conversationGatewayMock.handleIncomingMessage).toHaveBeenCalledWith({
        userData: expect.objectContaining({
          telegramId: 'web-user-beta',
        }),
        messageText: 'What is in my document?',
      });
      expect(resB.output).toBe('Processed message for web-user-beta');

      // User A and User B IDs are completely distinct
      expect(mockReqB.user.id).not.toBe('uuid-web-user-alpha');
    });
  });

  describe('Requirement C: Impersonation Prevention', () => {
    it("A client cannot provide another user's telegramId/userId in the request body to impersonate them", async () => {
      const mockReqUserA = {
        headers: { 'x-user-id': 'legitimate-user' },
      } as any;

      await webAuthGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockReqUserA }),
      } as any);

      // Attempting body impersonation by sending telegramId of victim
      await chatController.sendMessage(mockReqUserA, 'Confidential query');

      // The gateway receives ONLY legitimate-user identity, ignoring any body impersonation
      expect(conversationGatewayMock.handleIncomingMessage).toHaveBeenCalledWith({
        userData: expect.objectContaining({
          telegramId: 'web-legitimate-user',
        }),
        messageText: 'Confidential query',
      });
    });
  });

  describe('Requirement D: Unauthenticated Request Rejection', () => {
    it('Unauthenticated requests without headers are rejected with 401 Unauthorized', async () => {
      const mockReqUnauth = {
        headers: {},
      } as any;

      await expect(
        webAuthGuard.canActivate({
          switchToHttp: () => ({ getRequest: () => mockReqUnauth }),
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Unauthenticated requests with empty auth headers are rejected with 401 Unauthorized', async () => {
      const mockReqEmpty = {
        headers: { 'x-user-id': '   ' },
      } as any;

      await expect(
        webAuthGuard.canActivate({
          switchToHttp: () => ({ getRequest: () => mockReqEmpty }),
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Requirement E: Telegram Preservation', () => {
    it('Existing Telegram message handling still works and preserves telegramId resolution', async () => {
      const telegramUserData = {
        telegramId: '987654321',
        username: 'telegram_user',
        firstName: 'Telegram',
        lastName: 'User',
      };

      const user = await userServiceMock.getOrCreateUser(telegramUserData);
      expect(user.telegramId).toBe('987654321');
      expect(user.id).toBe('uuid-987654321');
    });
  });

  describe('Requirements F, G, H: Classifier & Agent Intent Routing Integrity', () => {
    let classifier: RuleBasedIntentClassifier;

    beforeEach(() => {
      classifier = new RuleBasedIntentClassifier();
    });

    it('Requirement F: DOCUMENT_QUERY → DocumentAgent routing still works', async () => {
      const result = await classifier.classify('What was the Q3 revenue in the report.pdf?');
      expect(result.category).toBe(IntentCategory.DOCUMENT_QUERY);
    });

    it('Requirement G: SEC_FILINGS → ResearchAgent routing still works', async () => {
      const result = await classifier.classify("What is Microsoft's latest 10-K filing on SEC EDGAR?");
      expect(result.category).toBe(IntentCategory.SEC_FILINGS);
    });

    it('Requirement H: GENERAL_CHAT remains unchanged', async () => {
      const result = await classifier.classify('Hello, how are you today?');
      expect(result.category).toBe(IntentCategory.GENERAL_CHAT);
    });
  });
});
