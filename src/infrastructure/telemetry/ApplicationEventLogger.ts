import { IApplicationEventBus, ApplicationEvent, ApplicationEventPayloads } from '../../domain/ports/IApplicationEventBus.js';
import { ILogger } from '../../domain/ports/ILogger.js';

export class ApplicationEventLogger {
  private unsubscribes: (() => void)[] = [];

  constructor(
    private eventBus: IApplicationEventBus,
    private logger: ILogger
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
        this.logEvent(event);
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

  private logEvent(event: ApplicationEvent): void {
    const logData = {
      eventId: event.eventId,
      event: event.event,
      version: event.version,
      occurredAt: event.occurredAt,
      source: event.source,
      traceId: event.traceId,
      requestId: event.requestId,
      sessionId: event.sessionId,
      marketplace: event.marketplace,
      profileId: event.profileId,
      payload: event.payload
    };

    const eventName = event.event;
    const msg = `[ApplicationEvent] ${eventName} emitted by ${event.source}`;

    if (eventName === 'NORMALIZATION_FAILED' || eventName === 'AUTHENTICATION_FAILED') {
      this.logger.error(logData, msg, (event.payload as any)?.reason ? new Error((event.payload as any).reason) : undefined);
    } else {
      this.logger.info(logData, msg);
    }
  }
}
