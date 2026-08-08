import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/http-exception.filter';
import { AppLogger } from '@/common/logger/logger.service';

async function bootstrap() {
  const logger = new AppLogger();

  logger.log('Starting Atlas AI backend bootstrap...', 'Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  logger.log('Nest application created successfully.', 'Bootstrap');

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;

  logger.log(`About to call app.listen() on port ${port}...`, 'Bootstrap');

  try {
    await app.listen(port);

    logger.log(`app.listen() completed successfully.`, 'Bootstrap');

    logger.log(`Atlas AI Backend Engine running on port ${port}`, 'Bootstrap');

    logger.log(`Health endpoint: http://localhost:${port}/health`, 'Bootstrap');
  } catch (error: any) {
    logger.error(`Failed to start HTTP server: ${error.message}`, error.stack, 'Bootstrap');

    process.exit(1);
  }
}

bootstrap();
