import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/http-exception.filter';
import { APP_CONFIG, AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(
    new AppExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.enableShutdownHooks();

  await app.listen(config.port);
  const logger = new Logger('Bootstrap');
  logger.log(
    `Azeroth Flip API listening on http://localhost:${config.port}/api`,
  );
  if (!config.blizzard.clientId || !config.blizzard.clientSecret) {
    logger.warn(
      'BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET not set: live data disabled. Load SAMPLE data from the UI or POST /api/sample/load.',
    );
  }
}

void bootstrap();
