export type MarketplacePageType =
  | 'PRODUCT_PAGE'
  | 'AFFILIATE_LANDING'
  | 'LOGIN_PAGE'
  | 'CONSENT_PAGE'
  | 'ERROR_PAGE'
  | 'CAPTCHA_PAGE'
  | 'WAF_PAGE'
  | 'UNKNOWN';

export class MarketplaceUnavailableError extends Error {
  constructor(
    message: string,
    public readonly pageType: MarketplacePageType,
    public readonly pageTitle: string,
    public readonly url: string,
    public readonly marketplace: string,
    public readonly signatureMatched?: string,
    public readonly screenshotPath?: string,
    public readonly htmlSnippet?: string
  ) {
    super(message);
    this.name = 'MarketplaceUnavailableError';
  }
}
