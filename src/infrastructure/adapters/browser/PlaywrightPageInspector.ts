import { IPageInspector, Cookie } from '../../../domain/ports/IPageInspector.js';

export class PlaywrightPageInspector implements IPageInspector {
  constructor(private page: any) {}

  public async url(): Promise<string> {
    return this.page.url();
  }

  public async cookies(): Promise<Cookie[]> {
    try {
      const playwrightCookies = await this.page.context().cookies();
      return playwrightCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite || 'Lax'
      }));
    } catch {
      return [];
    }
  }

  public async text(selector: string): Promise<string | null> {
    try {
      const content = await this.page.locator(selector).textContent();
      return content ? content.trim() : null;
    } catch {
      return null;
    }
  }

  public async exists(selector: string): Promise<boolean> {
    try {
      const count = await this.page.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }
}
