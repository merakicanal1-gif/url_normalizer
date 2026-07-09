import { pino } from 'pino';
import { ILogger } from '../../../domain/ports/ILogger.js';
import { sanitizePayload } from './Sanitizer.js';

export class PinoLogger implements ILogger {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        'body.storageState',
        'headers.cookie',
        'headers.authorization'
      ],
      censor: '***'
    }
  });

  public info(context: any, message?: string): void {
    const sanitized = sanitizePayload(context);
    this.logger.info(sanitized, message);
  }

  public warn(context: any, message?: string): void {
    const sanitized = sanitizePayload(context);
    this.logger.warn(sanitized, message);
  }

  public error(context: any, message?: string, error?: any): void {
    const sanitized = sanitizePayload(context);
    if (error instanceof Error) {
      sanitized.error = {
        message: error.message,
        stack: error.stack
      };
    } else if (error) {
      sanitized.error = error;
    }
    this.logger.error(sanitized, message);
  }
}
