export interface ResolverExecution {
  resolver: string;
  inputUrl: string;
  outputUrl: string;
  durationMs: number;
  skipped: boolean;
  changedMarketplace: boolean;
}
