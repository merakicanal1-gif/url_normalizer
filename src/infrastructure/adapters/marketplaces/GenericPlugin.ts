import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';

export class GenericPlugin implements IMarketplacePlugin {
  public canHandle(url: URL): boolean {
    // Retorna false pois é o plugin de fallback definitivo
    console.log(`[GenericPlugin] [canHandle] URL="${url.toString()}", Resultado=false (é o fallback)`);
    return false;
  }

  public getMarketplaceName(): string {
    return 'generic';
  }

  public getInteractiveEntryUrl(): string {
    return 'about:blank';
  }

  public async normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct> {
    console.log(`[GenericPlugin] [normalize] GenericPlugin selecionado. URL="${finalUrl.toString()}", Motivo=Nenhum plugin específico de marketplace pôde tratar esta URL final.`);
    // 1. Limpar parâmetros comuns de query para gerar uma URL limpa básica
    const cleanUrl = new URL(finalUrl.toString());
    cleanUrl.search = ''; // Remove todos os parâmetros de rastreamento genéricos
    cleanUrl.hash = '';

    // 2. Tentar extrair o Título e a imagem OpenGraph da página genérica
    const extractedData = await page.evaluate<{ title: string; image: string }>(() => {
      const title = document.title || document.querySelector('h1')?.textContent?.trim() || '';
      
      const ogImgEl = document.querySelector('meta[property="og:image"]');
      const image = ogImgEl ? ogImgEl.getAttribute('content') || '' : '';
      
      return { title, image };
    });

    return {
      success: true,
      marketplace: this.getMarketplaceName(),
      url_final: cleanUrl.toString(),
      id_produto: '', // Fallback não possui padrão de ID estruturado
      titulo: extractedData.title,
      imagem: extractedData.image
    };
  }
}
