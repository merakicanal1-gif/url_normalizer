export class MarketplaceHostRegistry {
  private static readonly AMAZON_HOSTS = new Set([
    'amzn.to',
    'link.amazon',
    'amazon.com.br',
    'amazon.com',
    'amazon.es',
    'amazon.it',
    'amazon.fr',
    'amazon.co.uk'
  ]);

  private static readonly MERCADO_LIVRE_HOSTS = new Set([
    'meli.la',
    'mercadolivre.com.br',
    'mercadolivre.com',
    'mercadolibre.com',
    'mercadolibre.com.ar'
  ]);

  public static isAmazon(hostname: string): boolean {
    const cleaned = hostname.toLowerCase();
    for (const host of this.AMAZON_HOSTS) {
      if (cleaned === host || cleaned.endsWith('.' + host)) {
        return true;
      }
    }
    return false;
  }

  public static isMercadoLivre(hostname: string): boolean {
    const cleaned = hostname.toLowerCase();
    for (const host of this.MERCADO_LIVRE_HOSTS) {
      if (cleaned === host || cleaned.endsWith('.' + host)) {
        return true;
      }
    }
    return false;
  }

  public static isShopee(hostname: string): boolean {
    const cleaned = hostname.toLowerCase();
    return (
      cleaned === 'shp.ee' ||
      cleaned.endsWith('.shp.ee') ||
      cleaned === 'shopee.com.br' ||
      cleaned.endsWith('.shopee.com.br') ||
      cleaned === 'shopee.com' ||
      cleaned.endsWith('.shopee.com')
    );
  }

  public static isKnownMarketplace(hostname: string): boolean {
    return this.isAmazon(hostname) || this.isMercadoLivre(hostname) || this.isShopee(hostname);
  }

  public static isAmazonAffiliate(hostname: string): boolean {
    const cleaned = hostname.toLowerCase().replace(/^www\./, '');
    return cleaned === 'amzn.to' || cleaned === 'link.amazon';
  }

  public static isMercadoLivreAffiliate(hostname: string): boolean {
    const cleaned = hostname.toLowerCase().replace(/^www\./, '');
    return cleaned === 'meli.la';
  }

  public static isShopeeAffiliate(hostname: string): boolean {
    const cleaned = hostname.toLowerCase();
    return (
      cleaned === 'shp.ee' ||
      cleaned.endsWith('.shp.ee') ||
      cleaned === 's.shopee.com.br' ||
      cleaned.endsWith('.s.shopee.com.br')
    );
  }
}
