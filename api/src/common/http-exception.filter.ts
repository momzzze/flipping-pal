import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import {
  BlizzardApiError,
  BlizzardCredentialsMissingError,
  BlizzardTargetUnsupportedError,
} from '../blizzard/blizzard.errors';

/** Maps domain errors (Blizzard, Prisma) to meaningful HTTP responses. */
@Catch()
export class AppExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    const send = (status: number, error: string, message: string) =>
      response.status(status).json({ statusCode: status, error, message });

    if (exception instanceof BlizzardCredentialsMissingError) {
      send(
        HttpStatus.SERVICE_UNAVAILABLE,
        'BlizzardCredentialsMissing',
        exception.message,
      );
      return;
    }
    if (exception instanceof BlizzardTargetUnsupportedError) {
      send(
        HttpStatus.SERVICE_UNAVAILABLE,
        'BlizzardTargetUnsupported',
        exception.message,
      );
      return;
    }
    if (exception instanceof BlizzardApiError) {
      this.logger.warn(
        `Blizzard API error on ${exception.path}: ${exception.message}`,
      );
      if (exception.status === 429) {
        send(
          HttpStatus.TOO_MANY_REQUESTS,
          'BlizzardRateLimited',
          exception.message,
        );
      } else if (exception.status === 404) {
        send(HttpStatus.NOT_FOUND, 'BlizzardNotFound', exception.message);
      } else {
        send(HttpStatus.BAD_GATEWAY, 'BlizzardApiError', exception.message);
      }
      return;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        send(
          HttpStatus.NOT_FOUND,
          'NotFound',
          'Requested record was not found',
        );
        return;
      }
      if (exception.code === 'P2003') {
        send(
          HttpStatus.CONFLICT,
          'Conflict',
          'Record is still referenced by other data',
        );
        return;
      }
    }
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    send(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'InternalServerError',
      'Unexpected server error',
    );
  }
}
