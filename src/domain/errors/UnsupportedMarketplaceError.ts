export class UnsupportedMarketplaceError extends Error {
  constructor(message: string = 'O marketplace identificado não é suportado por esta API.') {
    super(message);
    this.name = 'UnsupportedMarketplaceError';
  }
}
