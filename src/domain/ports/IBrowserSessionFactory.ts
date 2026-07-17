import { INavigatorPage } from './INavigator.js';

export interface IBrowserSessionFactory {
  createSession(marketplace: string, profileId?: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
  }>;
}
