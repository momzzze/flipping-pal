import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SampleService } from './sample.service';

/** CLI: loads the explicitly labeled SAMPLE dataset (npm run seed:sample). */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app.get(SampleService).load();
    console.log(`Loaded SAMPLE data: ${JSON.stringify(result)}`);
  } finally {
    await app.close();
  }
}

void main();
