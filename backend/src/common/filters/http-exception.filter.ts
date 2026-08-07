import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '@/common/logger/logger.service';
import { ApiResponse, createApiResponse } from '@/shared/interfaces';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal Server Error';

    const errorMessage =
      typeof rawMessage === 'string'
        ? rawMessage
        : (rawMessage as any).message || JSON.stringify(rawMessage);

    this.logger.error(
      `HTTP Exception on ${request.method} ${request.url}: ${errorMessage}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    const apiResponse: ApiResponse<null> = createApiResponse(
      false,
      `Request failed with status code ${status}`,
      null,
      errorMessage,
    );

    response.status(status).json(apiResponse);
  }
}
