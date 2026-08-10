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

  private static readonly UNSUPPORTED_STORES: Record<string, string> = {
    'riachuelo': 'Riachuelo',
    'magazineluiza': 'Magazine Luiza',
    'magalu': 'Magazine Luiza',
    'casasbahia': 'Casas Bahia',
    'pontofrio': 'Ponto Frio',
    'ponto.com': 'Ponto Frio',
    'extra.com': 'Extra',
    'aliexpress': 'AliExpress',
    'shein': 'Shein',
    'temu': 'Temu',
    'kabum': 'KaBuM!',
    'pichau': 'Pichau',
    'terabyteshop': 'TerabyteShop',
    'netshoes': 'Netshoes',
    'zattini': 'Zattini',
    'dafiti': 'Dafiti',
    'centauro': 'Centauro',
    'decathlon': 'Decathlon',
    'fastshop': 'Fast Shop',
    'carrefour': 'Carrefour',
    'americanas': 'Americanas',
    'submarino': 'Submarino',
    'shoptime': 'Shoptime',
    'madeiramadeira': 'MadeiraMadeira',
    'leroymerlin': 'Leroy Merlin',
    'kalunga': 'Kalunga',
    'drogasil': 'Drogasil',
    'drogaraia': 'Droga Raia',
    'panvel': 'Panvel',
    'belezanaweb': 'Beleza na Web',
    'epocacosmeticos': 'Época Cosméticos',
    'sephora': 'Sephora',
    'boticario': 'O Boticário',
    'natura': 'Natura',
    'avon': 'Avon',
    'lojasrenner': 'Renner',
    'renner': 'Renner',
    'cea.com': 'C&A',
    'marisa': 'Marisa',
    'havan': 'Havan',
    'nike.com': 'Nike',
    'adidas.com': 'Adidas',
    'samsung.com': 'Samsung',
    'dell.com': 'Dell',
    'girafa.com': 'Girafa'
  };

  public static getUnsupportedStoreInfo(hostname: string): { isUnsupported: boolean; name: string } {
    const cleaned = hostname.toLowerCase();
    
    // Se for Amazon ou Mercado Livre, NÃO é unsupported
    if (this.isAmazon(cleaned) || this.isMercadoLivre(cleaned)) {
      return { isUnsupported: false, name: '' };
    }

    for (const [key, name] of Object.entries(this.UNSUPPORTED_STORES)) {
      if (cleaned.includes(key)) {
        return { isUnsupported: true, name };
      }
    }

    return { isUnsupported: false, name: '' };
  }

  public static isGenericShortener(hostname: string): boolean {
    const cleaned = hostname.toLowerCase().replace(/^www\./, '');
    const shorteners = [
      'compre.link',
      'bit.ly',
      't.co',
      'tinyurl.com',
      'is.gd',
      'cutt.ly',
      'ow.ly',
      'rstyle.me',
      'awin1.com',
      'lomadee.com',
      'm9sr.adj.st',
      'app.adjust.com',
      'linkr.bio',
      'linktr.ee',
      'redir.pro',
      'oferta.me',
      'promocao.vip',
      'click.links'
    ];
    return shorteners.some(s => cleaned === s || cleaned.endsWith('.' + s));
  }
}
