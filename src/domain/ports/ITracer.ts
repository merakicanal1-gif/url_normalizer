export interface ITracer {
  startSpan(spanKey: string, name: string, attributes?: Record<string, any>): void;
  endSpan(spanKey: string): void;
  addEvent(spanKey: string, name: string, attributes?: Record<string, any>): void;
  setAttribute(spanKey: string, key: string, value: any): void;
  recordException(spanKey: string, error: Error): void;
}
