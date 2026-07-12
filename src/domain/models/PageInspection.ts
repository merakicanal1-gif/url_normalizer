import { MarketplacePageType } from '../errors/MarketplaceUnavailableError.js';

export interface PageInspection {
  pageType: MarketplacePageType | 'UNKNOWN';
  confidence: number;
  url: string;
  canonical?: string;
  title?: string;
  hasCTA: boolean;
  hasProductImage: boolean;
  hasBuyBox: boolean;
  hasMLB: boolean;
  evidences: string[];
}
