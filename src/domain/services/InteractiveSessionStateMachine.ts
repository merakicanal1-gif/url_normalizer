import { InteractiveSession, InteractiveSessionStatus } from '../models/InteractiveSession.js';

export class InvalidStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid state transition from ${from} to ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class InteractiveSessionStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<InteractiveSessionStatus, InteractiveSessionStatus[]> = {
    WAITING_LOGIN: ['LOGIN_IN_PROGRESS', 'EXPIRED', 'CLOSED'],
    LOGIN_IN_PROGRESS: ['READY_TO_SAVE', 'FAILED', 'EXPIRED', 'CLOSED'],
    READY_TO_SAVE: ['SAVED', 'FAILED', 'EXPIRED', 'CLOSED'],
    SAVED: ['CLOSED'],
    FAILED: ['WAITING_LOGIN', 'CLOSED'],
    EXPIRED: ['CLOSED'],
    CLOSED: []
  };

  public static canTransition(from: InteractiveSessionStatus, to: InteractiveSessionStatus): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static transition(session: InteractiveSession, to: InteractiveSessionStatus): void {
    if (!this.canTransition(session.status, to)) {
      throw new InvalidStateTransitionError(session.status, to);
    }
    session.status = to;
  }
}
