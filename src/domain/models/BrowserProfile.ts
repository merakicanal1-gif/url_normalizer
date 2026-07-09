export interface BrowserProfile {
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  viewport?: { width: number; height: number } | null;
  extraHTTPHeaders?: Record<string, string>;
  storageState?: string; // Caminho absoluto para arquivo de estado ou JSON string de estado
  colorScheme?: 'light' | 'dark' | 'no-preference';
  javaScriptEnabled?: boolean;
}
