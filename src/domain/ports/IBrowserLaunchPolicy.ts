export interface BrowserLaunchConfiguration {
  headless: boolean;
  args: string[];
  channel?: string;
  executablePath?: string;
  devtools?: boolean;
  slowMo?: number;
}

export interface BrowserContextConfiguration {
  locale: string;
  timezoneId: string;
  viewport: { width: number; height: number } | null;
  colorScheme: 'light' | 'dark' | 'no-preference';
  javaScriptEnabled: boolean;
  acceptDownloads: boolean;
  userAgent: string;
  extraHTTPHeaders: Record<string, string>;
  permissions: string[];
  geolocation?: { latitude: number; longitude: number; accuracy?: number };
}

export interface BrowserLaunchPolicyResult {
  launchOptions: BrowserLaunchConfiguration;
  contextOptions: BrowserContextConfiguration;
  initScripts: Array<{ source: string }>;
}

export interface IBrowserLaunchPolicy {
  getLaunchOptions(type: 'worker' | 'interactive', profile?: any): BrowserLaunchPolicyResult;
}
