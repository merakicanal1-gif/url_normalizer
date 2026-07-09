export interface IBrowserRuntime {
  start(): Promise<void>;
  shutdown(): Promise<void>;
  getWorkerBrowser(): any;
  getInteractiveBrowser(): any;
  healthCheck(): Promise<{ workerAlive: boolean; interactiveAlive: boolean }>;
}
