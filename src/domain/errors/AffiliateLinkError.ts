export class AffiliateLinkError extends Error {
  constructor(message: string = 'Não foi possível gerar o link de afiliado para este produto.') {
    super(message);
    this.name = 'AffiliateLinkError';
  }
}
