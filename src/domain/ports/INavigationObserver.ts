import { INavigatorPage } from './INavigator.js';

export interface INavigationObserver {
  waitForTransition(page: INavigatorPage, pendingClick?: Promise<void> | null): Promise<string>;
}
