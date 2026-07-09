import { BrowserContext, Page } from 'playwright-core';
import { InteractiveSession } from '../../../domain/models/InteractiveSession.js';

export interface InteractiveSessionRuntime {
  session: InteractiveSession;
  browserContext: BrowserContext;
  page: Page;
  infrastructure: {
    browserlessSessionId?: string;
    targetId?: string;
  };
}
