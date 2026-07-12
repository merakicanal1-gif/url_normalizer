import { INavigatorPage } from './INavigator.js';
import { PageInspection } from '../models/PageInspection.js';

export interface IPageClassifier {
  classify(page: INavigatorPage, url: string): Promise<PageInspection>;
}
