import { ApplicationEvent } from './IApplicationEventBus.js';

export interface ILogger {
  info(context: any, message?: string): void;
  warn(context: any, message?: string): void;
  error(context: any, message?: string, error?: any): void;
}
