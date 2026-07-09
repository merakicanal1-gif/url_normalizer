import { IClock } from '../../../domain/ports/IClock.js';

export class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }
}
