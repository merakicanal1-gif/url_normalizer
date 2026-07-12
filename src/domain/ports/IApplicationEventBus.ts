export interface ApplicationEventPayloads {
  APPLICATION_STARTED: Record<string, never>;
  APPLICATION_STOPPED: Record<string, never>;

  BROWSER_STARTED: { type: 'headless' | 'headful'; version?: string };
  BROWSER_STOPPED: { type: 'headless' | 'headful' };

  BROWSER_CONTEXT_CREATED: { type: 'headless' | 'headful'; contextId: string };
  BROWSER_CONTEXT_CLOSED: { contextId: string };

  AUTHENTICATION_STARTED: { marketplace: string; profileId: string; authenticationId: string };
  AUTHENTICATION_COMPLETED: { marketplace: string; profileId: string; authenticationId: string };
  AUTHENTICATION_FAILED: { marketplace: string; profileId: string; authenticationId: string; reason: string };
  AUTHENTICATION_EXPIRED: { marketplace: string; profileId: string; authenticationId: string };

  PROFILE_LOADED: { marketplace: string; profileId: string };
  PROFILE_SAVED: { marketplace: string; profileId: string; version: number };

  NORMALIZATION_STARTED: { url: string; marketplace: string; profileId?: string };
  NORMALIZATION_COMPLETED: { url: string; marketplace: string; durationMs: number };
  NORMALIZATION_FAILED: { url: string; marketplace: string; reason: string };

  PAGE_NAVIGATED: { url: string };
  PRODUCT_EXTRACTED: { marketplace: string; id: string; price?: number };

  // Novos eventos do subsistema de perfis e sessões
  PROFILE_CREATED: { marketplace: string; profileId: string; createdBy: string };
  PROFILE_EXPORTED: { marketplace: string; profileId: string; durationMs?: number };
  PROFILE_IMPORTED: { marketplace: string; profileId: string; version: number };
  PROFILE_VALIDATED: { marketplace: string; profileId: string; isValid: boolean; errors?: string[] };
  PROFILE_REFRESHED: { marketplace: string; profileId: string; status: string; confidence: number };
  PROFILE_CORRUPTED: { marketplace: string; profileId: string; reason: string };
  SESSION_EXPIRED: { marketplace: string; profileId: string; reason?: string };
  LOGIN_REQUIRED: { marketplace: string; profileId: string; reason?: string };
  CAPTCHA_REQUIRED: { marketplace: string; profileId: string; reason?: string };
  PROFILE_USED: { marketplace: string; profileId: string; success: boolean };
  NORMALIZE_COMPLETED: { url: string; marketplace: string; durationMs: number };
}

export interface ApplicationEvent<T extends keyof ApplicationEventPayloads = any> {
  readonly eventId: string;
  readonly event: T;
  readonly version: number;
  readonly occurredAt: string;
  readonly source: string;
  readonly traceId: string | null;
  readonly requestId: string | null;
  readonly sessionId: string | null; // For backward compatibility or general sessions
  readonly marketplace: string | null;
  readonly profileId: string | null;
  readonly payload: ApplicationEventPayloads[T];
}

export interface IApplicationEventBus {
  publish<T extends keyof ApplicationEventPayloads>(event: ApplicationEvent<T>): void;
  subscribe<T extends keyof ApplicationEventPayloads>(
    event: T,
    listener: (event: ApplicationEvent<T>) => void
  ): () => void;
}
