import { ResolverExecution } from './ResolverExecution.js';
import { SessionStatus } from '../AuthenticationSessionStatus.js';
import { NormalizeResultTrace } from './NormalizeResultTrace.js';

export interface NormalizeExecutionTrace {
  executionId: string;
  traceVersion: 1;
  startedAt: string;
  finishedAt?: string;
  totalDurationMs?: number;
  originalUrl: string;
  estimatedMarketplace?: string;
  resolvedMarketplace?: string;
  profileId?: string;
  profileLoaded: boolean;
  storageStateLoaded: boolean;
  cookiesLoaded: number;
  browserContextCreated: boolean;
  browserContextReused: boolean;
  redirectCount: number;
  resolverChain: ResolverExecution[];
  finalUrl?: string;
  normalizeSucceeded: boolean;
  failureReason?: string;
  runtime?: 'worker' | 'interactive';
  browserMode?: 'headless' | 'headful';
  authenticationStatusBefore?: SessionStatus;
  authenticationStatusAfter?: SessionStatus;
  extractionResult?: NormalizeResultTrace;
}
