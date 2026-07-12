import { INavigatorPage } from './INavigator.js';
import { NormalizedProduct } from '../models/Product.js';

export interface IProductExtractor {
  extract(page: INavigatorPage, url: string, marketplaceName: string): Promise<NormalizedProduct>;
}
