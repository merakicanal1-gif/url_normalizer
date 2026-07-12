import { AsyncLocalStorage } from 'node:async_hooks';
import { ILogger } from '../../domain/ports/ILogger.js';
import { SessionStatus } from '../../domain/models/AuthenticationSessionStatus.js';
import { NormalizeResultTrace } from '../../domain/models/trace/NormalizeResultTrace.js';
import { NormalizeExecutionTrace } from '../../domain/models/trace/NormalizeExecutionTrace.js';
import {
  INormalizeTelemetry,
  StartContext,
  BrowserTrace,
  StorageTrace,
  ResolverStartTrace,
  ResolverFinishedTrace,
  RedirectTrace
} from '../../domain/ports/INormalizeTelemetry.js';

interface TelemetryContext {
  executionId: string;
  trace: NormalizeExecutionTrace;
}

export class StructuredNormalizeTelemetry implements INormalizeTelemetry {
  private static asyncLocalStorage = new AsyncLocalStorage<TelemetryContext>();
  private static lastTrace?: NormalizeExecutionTrace;

  constructor(private logger?: ILogger) {}

  public static getLastTrace(): NormalizeExecutionTrace | undefined {
    return this.lastTrace;
  }

  public async run<T>(executionId: string, originalUrl: string, callback: () => Promise<T>): Promise<T> {
    const trace: NormalizeExecutionTrace = {
      executionId,
      traceVersion: 1,
      startedAt: new Date().toISOString(),
      originalUrl,
      profileLoaded: false,
      storageStateLoaded: false,
      cookiesLoaded: 0,
      browserContextCreated: false,
      browserContextReused: false,
      redirectCount: 0,
      resolverChain: [],
      normalizeSucceeded: false
    };

    return StructuredNormalizeTelemetry.asyncLocalStorage.run({ executionId, trace }, async () => {
      try {
        const result = await callback();
        return result;
      } finally {
        StructuredNormalizeTelemetry.lastTrace = trace;
      }
    });
  }

  private getStore(): TelemetryContext | undefined {
    return StructuredNormalizeTelemetry.asyncLocalStorage.getStore();
  }

  private log(data: any): void {
    if (this.logger) {
      this.logger.info(data);
    } else {
      console.log(JSON.stringify(data));
    }
  }

  public begin(context: StartContext): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.profileId = context.profileId;
    store.trace.profileLoaded = !!context.profileId;
    store.trace.runtime = context.runtime;
    store.trace.browserMode = context.browserMode;
    store.trace.authenticationStatusBefore = context.authStatusBefore;

    this.log({
      executionId: store.executionId,
      stage: 'NormalizeStarted',
      url: context.originalUrl
    });
  }

  public estimatedMarketplace(marketplace: string): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.estimatedMarketplace = marketplace;

    this.log({
      executionId: store.executionId,
      stage: 'MarketplaceEstimated',
      marketplace
    });
  }

  public resolvedMarketplace(marketplace: string): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.resolvedMarketplace = marketplace;

    this.log({
      executionId: store.executionId,
      stage: 'MarketplaceResolved',
      marketplace
    });
  }

  public browserCreated(trace: BrowserTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.browserContextCreated = true;
    store.trace.runtime = trace.runtime;
    store.trace.browserMode = trace.browserMode;

    this.log({
      executionId: store.executionId,
      stage: 'BrowserCreated',
      runtime: trace.runtime,
      browserMode: trace.browserMode
    });
  }

  public browserReused(trace: BrowserTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.browserContextReused = true;
    store.trace.runtime = trace.runtime;
    store.trace.browserMode = trace.browserMode;

    this.log({
      executionId: store.executionId,
      stage: 'BrowserReused',
      runtime: trace.runtime,
      browserMode: trace.browserMode
    });
  }

  public storageStateLoaded(trace: StorageTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.storageStateLoaded = trace.cookiesCount > 0;
    store.trace.cookiesLoaded = trace.cookiesCount;

    this.log({
      executionId: store.executionId,
      stage: 'StorageStateLoaded',
      profile: trace.profileId,
      cookies: trace.cookiesCount
    });
  }

  public resolverStarted(trace: ResolverStartTrace): void {
    const store = this.getStore();
    if (!store) return;

    this.log({
      executionId: store.executionId,
      stage: 'ResolverStarted',
      resolver: trace.resolver
    });
  }

  public resolverFinished(trace: ResolverFinishedTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.resolverChain.push({
      resolver: trace.resolver,
      inputUrl: trace.inputUrl,
      outputUrl: trace.outputUrl,
      durationMs: trace.durationMs,
      skipped: trace.skipped,
      changedMarketplace: trace.changedMarketplace
    });

    this.log({
      executionId: store.executionId,
      stage: 'ResolverFinished',
      resolver: trace.resolver,
      durationMs: trace.durationMs,
      redirects: trace.redirectsCount
    });
  }

  public redirect(trace: RedirectTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.redirectCount += 1;

    this.log({
      executionId: store.executionId,
      stage: 'Redirect',
      resolver: trace.resolver,
      from: trace.fromUrl,
      to: trace.toUrl,
      reason: trace.reason
    });
  }

  public normalizeResult(result: NormalizeResultTrace): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.extractionResult = result;

    this.log({
      executionId: store.executionId,
      stage: 'NormalizeResult',
      marketplace: result.marketplace,
      productId: result.productId,
      canonicalUrl: result.canonicalUrl
    });
  }

  public finished(finalUrl: string, durationMs: number, authStatusAfter?: SessionStatus): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.finishedAt = new Date().toISOString();
    store.trace.totalDurationMs = durationMs;
    store.trace.finalUrl = finalUrl;
    store.trace.normalizeSucceeded = true;
    store.trace.authenticationStatusAfter = authStatusAfter;

    this.log({
      executionId: store.executionId,
      stage: 'NormalizeFinished',
      durationMs,
      success: true
    });
  }

  public failed(reason: string, durationMs: number, authStatusAfter?: SessionStatus): void {
    const store = this.getStore();
    if (!store) return;

    store.trace.finishedAt = new Date().toISOString();
    store.trace.totalDurationMs = durationMs;
    store.trace.normalizeSucceeded = false;
    store.trace.failureReason = reason;
    store.trace.authenticationStatusAfter = authStatusAfter;

    this.log({
      executionId: store.executionId,
      stage: 'NormalizeFinished',
      durationMs,
      success: false,
      reason
    });
  }
}
