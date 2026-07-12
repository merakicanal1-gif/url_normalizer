import { SessionStatus } from '../../domain/models/AuthenticationSessionStatus.js';
import { NormalizeResultTrace } from '../../domain/models/trace/NormalizeResultTrace.js';
import {
  INormalizeTelemetry,
  StartContext,
  BrowserTrace,
  StorageTrace,
  ResolverStartTrace,
  ResolverFinishedTrace,
  RedirectTrace
} from '../../domain/ports/INormalizeTelemetry.js';

export class NoOpNormalizeTelemetry implements INormalizeTelemetry {
  public async run<T>(_executionId: string, _originalUrl: string, callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  public begin(_context: StartContext): void {}
  public estimatedMarketplace(_marketplace: string): void {}
  public resolvedMarketplace(_marketplace: string): void {}
  public browserCreated(_trace: BrowserTrace): void {}
  public browserReused(_trace: BrowserTrace): void {}
  public storageStateLoaded(_trace: StorageTrace): void {}
  public resolverStarted(_trace: ResolverStartTrace): void {}
  public resolverFinished(_trace: ResolverFinishedTrace): void {}
  public redirect(_trace: RedirectTrace): void {}
  public normalizeResult(_result: NormalizeResultTrace): void {}
  public finished(_finalUrl: string, _durationMs: number, _authStatusAfter?: SessionStatus): void {}
  public failed(_reason: string, _durationMs: number, _authStatusAfter?: SessionStatus): void {}
}
