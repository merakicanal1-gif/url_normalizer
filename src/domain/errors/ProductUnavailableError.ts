export class ProductUnavailableError extends Error {
  constructor(message: string = 'O produto não está disponível ou não pôde ser encontrado.') {
    super(message);
    this.name = 'ProductUnavailableError';
  }
}
