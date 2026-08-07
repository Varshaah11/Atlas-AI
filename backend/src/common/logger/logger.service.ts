import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class AppLogger implements NestLoggerService {
  log(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${context ? `[${context}] ` : ''}${message}`);
  }

  error(message: string, trace?: string, context?: string) {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] [ERROR] ${context ? `[${context}] ` : ''}${message}`,
      trace ? `\nStack: ${trace}` : '',
    );
  }

  warn(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${context ? `[${context}] ` : ''}${message}`);
  }

  debug(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [DEBUG] ${context ? `[${context}] ` : ''}${message}`);
  }
}
