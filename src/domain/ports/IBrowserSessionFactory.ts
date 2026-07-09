import { INavigatorPage } from './INavigator.js';

export interface IBrowserSessionFactory {
  createSession(marketplace: string, profileId?: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
  }>;

  createInteractiveSession(marketplace: string, profileId: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
    storageState: () => Promise<any>;
  }>;
}
