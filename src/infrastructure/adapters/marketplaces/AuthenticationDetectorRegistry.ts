import { IAuthenticationDetector } from '../../../domain/ports/IAuthenticationDetector.js';

export class AuthenticationDetectorRegistry {
  private detectors = new Map<string, IAuthenticationDetector>();

  public register(marketplace: string, detector: IAuthenticationDetector): void {
    this.detectors.set(marketplace.toLowerCase(), detector);
  }

  public unregister(marketplace: string): void {
    this.detectors.delete(marketplace.toLowerCase());
  }

  public has(marketplace: string): boolean {
    return this.detectors.has(marketplace.toLowerCase());
  }

  public get(marketplace: string): IAuthenticationDetector | null {
    return this.detectors.get(marketplace.toLowerCase()) || null;
  }
}
