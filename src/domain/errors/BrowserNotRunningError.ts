export class BrowserNotRunningError extends Error {
  public readonly code = 'BROWSER_NOT_RUNNING';
  public readonly documentation = '/docs/browser-setup';

  constructor(message: string = 'Nenhum navegador compatível foi encontrado em modo de depuração.') {
    super(message);
    this.name = 'BrowserNotRunningError';
    Object.setPrototypeOf(this, BrowserNotRunningError.prototype);
  }
}
