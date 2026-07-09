import { IMarketplacePlugin } from '../../domain/ports/IMarketplacePlugin.js';

export class MarketplaceRegistry {
  private plugins: IMarketplacePlugin[] = [];
  private fallbackPlugin: IMarketplacePlugin | null = null;

  public register(plugin: IMarketplacePlugin): void {
    this.plugins.push(plugin);
  }

  public registerFallback(plugin: IMarketplacePlugin): void {
    this.fallbackPlugin = plugin;
  }

  public resolve(url: URL): IMarketplacePlugin {
    console.log(`[MarketplaceRegistry] [resolve] URL recebida="${url.toString()}", Host="${url.hostname}"`);
    for (const plugin of this.plugins) {
      if (plugin.canHandle(url)) {
        console.log(`[MarketplaceRegistry] [resolve] Plugin encontrado: ${plugin.constructor.name}, Marketplace="${plugin.getMarketplaceName()}"`);
        return plugin;
      }
    }

    if (this.fallbackPlugin) {
      console.log(`[MarketplaceRegistry] [resolve] Plugin fallback utilizado: ${this.fallbackPlugin.constructor.name}, Marketplace="${this.fallbackPlugin.getMarketplaceName()}"`);
      return this.fallbackPlugin;
    }

    const errMsg = `Nenhum plugin de marketplace compatível encontrado para a URL: ${url.toString()}`;
    console.log(`[MarketplaceRegistry] [resolve] ERRO: ${errMsg}`);
    throw new Error(errMsg);
  }

  public getPlugins(): IMarketplacePlugin[] {
    return [...this.plugins];
  }
}
