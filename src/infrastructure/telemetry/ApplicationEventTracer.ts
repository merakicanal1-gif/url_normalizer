import { IApplicationEventBus, ApplicationEvent, ApplicationEventPayloads } from '../../domain/ports/IApplicationEventBus.js';
import { ITracer } from '../../domain/ports/ITracer.js';

export class ApplicationEventTracer {
  private unsubscribes: (() => void)[] = [];

  constructor(
    private eventBus: IApplicationEventBus,
    private tracer: ITracer
  ) {}

  public start(): void {
    const eventsList: (keyof ApplicationEventPayloads)[] = [
      'APPLICATION_STARTED',
      'APPLICATION_STOPPED',
      'BROWSER_STARTED',
      'BROWSER_STOPPED',
      'BROWSER_CONTEXT_CREATED',
      'BROWSER_CONTEXT_CLOSED',
      'AUTHENTICATION_STARTED',
      'AUTHENTICATION_COMPLETED',
      'AUTHENTICATION_FAILED',
      'AUTHENTICATION_EXPIRED',
      'PROFILE_LOADED',
      'PROFILE_SAVED',
      'NORMALIZATION_STARTED',
      'NORMALIZATION_COMPLETED',
      'NORMALIZATION_FAILED',
      'PAGE_NAVIGATED',
      'PRODUCT_EXTRACTED'
    ];

    for (const eventName of eventsList) {
      const unsub = this.eventBus.subscribe(eventName, (event: ApplicationEvent) => {
        try {
          this.handleEvent(event);
        } catch (err) {
          // Tracing is best effort
        }
      });
      this.unsubscribes.push(unsub);
    }
  }

  public stop(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
  }

  private handleEvent(event: ApplicationEvent): void {
    // Spans mapping will be implemented in Fase 2
  }
}
