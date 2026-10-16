import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { ClassicForeverScanImporter } from './classic-forever-scan-importer';

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error(
      'Usage: npm run import:classic-scan -- <path-to-AzerothFlipScanner.lua>',
    );
  }

  const contents = await readFile(resolve(filePath), 'utf8');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await app
      .get(ClassicForeverScanImporter)
      .importSavedVariables(contents);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});