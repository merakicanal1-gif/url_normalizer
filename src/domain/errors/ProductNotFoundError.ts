export class ProductNotFoundError extends Error {
  constructor(message: string = 'A URL informada não corresponde a uma página de produto.') {
    super(message);
    this.name = 'ProductNotFoundError';
  }
}
