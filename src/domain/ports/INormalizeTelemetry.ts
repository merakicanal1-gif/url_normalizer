import { SessionStatus } from '../models/AuthenticationSessionStatus.js';
import { RedirectReason } from '../models/trace/RedirectReason.js';
import { NormalizeResultTrace } from '../models/trace/NormalizeResultTrace.js';

export interface StartContext {
  originalUrl: string;
  profileId?: string;
  runtime?: 'worker' | 'interactive';
  browserMode?: 'headless' | 'headful';
  authStatusBefore?: SessionStatus;
}

export interface BrowserTrace {
  runtime: 'worker' | 'interactive';
  browserMode: 'headless' | 'headful';
}

export interface StorageTrace {
  profileId: string;
  cookiesCount: number;
}

export interface ResolverStartTrace {
  resolver: string;
  inputUrl: string;
}

export interface ResolverFinishedTrace {
  resolver: string;
  inputUrl: string;
  outputUrl: string;
  durationMs: number;
  skipped: boolean;
  redirectsCount: number;
  changedMarketplace: boolean;
}

export interface RedirectTrace {
  resolver: string;
  fromUrl: string;
  toUrl: string;
  reason: RedirectReason;
}

export interface INormalizeTelemetry {
  run<T>(executionId: string, originalUrl: string, callback: () => Promise<T>): Promise<T>;
  begin(context: StartContext): void;
  estimatedMarketplace(marketplace: string): void;
  resolvedMarketplace(marketplace: string): void;
  browserCreated(trace: BrowserTrace): void;
  browserReused(trace: BrowserTrace): void;
  storageStateLoaded(trace: StorageTrace): void;
  resolverStarted(trace: ResolverStartTrace): void;
  resolverFinished(trace: ResolverFinishedTrace): void;
  redirect(trace: RedirectTrace): void;
  normalizeResult(result: NormalizeResultTrace): void;
  finished(finalUrl: string, durationMs: number, authStatusAfter?: SessionStatus): void;
  failed(reason: string, durationMs: number, authStatusAfter?: SessionStatus): void;
}
