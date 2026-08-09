export interface IBrowserRuntime {
  start(): Promise<void>;
  shutdown(): Promise<void>;
  getPersistentContext(): any;
  newPage(isManaged?: boolean, marketplace?: string): Promise<any>;
  closePage(page: any): Promise<void>;
  restart(): Promise<void>;
  closeAllPages(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
