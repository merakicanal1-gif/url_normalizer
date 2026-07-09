export interface INavigatorPage {
  goto(url: string, timeoutMs?: number): Promise<string>;
  getFinalUrl(): string;
  evaluate<T>(fn: string | ((...args: any[]) => T), arg?: any): Promise<T>;
  close(): Promise<void>;
}
