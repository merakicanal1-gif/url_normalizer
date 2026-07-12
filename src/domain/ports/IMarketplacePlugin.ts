import { INavigatorPage } from './INavigator.js';
import { NormalizedProduct } from '../models/Product.js';
import { IAuthenticationStrategy } from './IAuthenticationStrategy.js';

export interface IMarketplacePlugin {
  canHandle(url: URL): boolean;
  getMarketplaceName(): string;
  getInteractiveEntryUrl(): string;
  normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct>;
  getAuthenticationStrategy(): IAuthenticationStrategy;
}
