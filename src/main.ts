import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  // Application runs as a background worker processing Telegram updates.
}
bootstrap();
