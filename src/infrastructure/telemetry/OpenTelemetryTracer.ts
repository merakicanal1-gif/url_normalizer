import { trace, Span, Tracer } from '@opentelemetry/api';
import { ITracer } from '../../domain/ports/ITracer.js';

export class OpenTelemetryTracer implements ITracer {
  private tracer: Tracer;
  private activeSpans = new Map<string, Span>();

  constructor(tracerName = 'url-normalizer') {
    this.tracer = trace.getTracer(tracerName);
  }

  public startSpan(spanKey: string, name: string, attributes?: Record<string, any>): void {
    const span = this.tracer.startSpan(name, { attributes });
    this.activeSpans.set(spanKey, span);
  }

  public endSpan(spanKey: string): void {
    const span = this.activeSpans.get(spanKey);
    if (span) {
      span.end();
      this.activeSpans.delete(spanKey);
    }
  }

  public addEvent(spanKey: string, name: string, attributes?: Record<string, any>): void {
    const span = this.activeSpans.get(spanKey);
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  public setAttribute(spanKey: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanKey);
    if (span) {
      span.setAttribute(key, value);
    }
  }

  public recordException(spanKey: string, error: Error): void {
    const span = this.activeSpans.get(spanKey);
    if (span) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // 2 = ERROR code in OpenTelemetry API Status
    }
  }

  public getActiveSpan(spanKey: string): Span | undefined {
    return this.activeSpans.get(spanKey);
  }
}
