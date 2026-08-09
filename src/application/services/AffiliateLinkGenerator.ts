export class AffiliateLinkGenerator {
  public generate(marketplace: string, productUrl: string, productId?: string | null): string | null {
    if (!productUrl || !productId) return null;
    const mkt = marketplace.toLowerCase();

    if (mkt === 'amazon') {
      return null;
    }

    if (mkt === 'mercadolivre') {
      return null; // O link oficial é obtido pelo plugin/extrator diretamente da toolbar
    }

    return null;
  }
}
