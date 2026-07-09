export type InteractiveSessionStatus = 
  | 'WAITING_LOGIN' 
  | 'LOGIN_IN_PROGRESS' 
  | 'READY_TO_SAVE' 
  | 'SAVED' 
  | 'FAILED' 
  | 'EXPIRED' 
  | 'CLOSED';

export interface InteractiveSessionDebug {
  available: boolean;
  provider: 'browserless';
  generatedAt: string;
  websocket: string | null;
  targetId: string | null;
  /** @deprecated Use websocket e targetId com seu próprio cliente CDP local (ex: chrome://inspect) */
  devtools?: string | null;
  /** @deprecated Não recomendado para visualização direta via API */
  vnc?: string | null;
  /** @deprecated Use websocket e targetId com seu próprio cliente CDP local (ex: chrome://inspect) */
  inspector?: string | null;
}

export interface InteractiveSession {
  sessionId: string;
  marketplace: string;
  profileId: string;
  status: InteractiveSessionStatus;
  owner: string;
  createdBy: string | null;
  clientIp: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  pendingSave: boolean;
  loginCompleted: boolean;
  lastInteraction?: string;
  debug: InteractiveSessionDebug;
  requestId: string;
  traceId: string;
}
