export interface ISessionLock {
  acquire(profileId: string, timeoutMs?: number): Promise<boolean>;
  release(profileId: string): Promise<void>;
}
