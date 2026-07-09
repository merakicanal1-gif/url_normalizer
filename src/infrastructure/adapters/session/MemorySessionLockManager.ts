import { ISessionLock } from '../../../domain/ports/ISessionLock.js';

export class MemorySessionLockManager implements ISessionLock {
  private locks = new Map<string, (() => void)[]>();

  public async acquire(profileId: string, timeoutMs: number = 5000): Promise<boolean> {
    const queue = this.locks.get(profileId) || [];
    this.locks.set(profileId, queue);

    if (queue.length === 0) {
      // Nenhum lock ativo para este perfil. Adquire imediatamente.
      queue.push(() => {});
      return true;
    }

    // Lock ativo. Adiciona o resolver na fila de espera.
    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Timeout atingido. Remove a promessa pendente da fila
          const currentQueue = this.locks.get(profileId) || [];
          const index = currentQueue.indexOf(notify);
          if (index !== -1) {
            currentQueue.splice(index, 1);
          }
          if (currentQueue.length === 0) {
            this.locks.delete(profileId);
          }
          resolve(false);
        }
      }, timeoutMs);

      const notify = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      queue.push(notify);
    });
  }

  public async release(profileId: string): Promise<void> {
    const queue = this.locks.get(profileId);
    if (!queue || queue.length === 0) {
      return;
    }

    // Libera a execução atual
    queue.shift();

    if (queue.length > 0) {
      // Notifica a próxima requisição pendente na fila
      const next = queue[0];
      next();
    } else {
      this.locks.delete(profileId);
    }
  }
}
