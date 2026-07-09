import { IApplicationEventBus, ApplicationEvent, ApplicationEventPayloads } from '../../../domain/ports/IApplicationEventBus.js';

function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function checkSerializable(value: any, path: string = ''): void {
  if (value === undefined || value === null) return;
  const type = typeof value;
  if (type === 'function') {
    throw new Error(`Invalid event: property at path '${path}' is a function, which is not JSON serializable.`);
  }
  if (type === 'symbol') {
    throw new Error(`Invalid event: property at path '${path}' is a Symbol, which is not JSON serializable.`);
  }
  if (type === 'bigint') {
    throw new Error(`Invalid event: property at path '${path}' is a BigInt, which is not JSON serializable.`);
  }
  if (type === 'object') {
    if (value instanceof Map || value instanceof Set) {
      throw new Error(`Invalid event: property at path '${path}' is a Map or Set, which is not JSON serializable.`);
    }
    if (value instanceof Buffer || value instanceof RegExp) {
      throw new Error(`Invalid event: property at path '${path}' is a Buffer or RegExp, which is not JSON serializable.`);
    }
    if (typeof value.pipe === 'function' && typeof value.on === 'function') {
      throw new Error(`Invalid event: property at path '${path}' is a Stream, which is not JSON serializable.`);
    }
    if (!isPlainObject(value) && !Array.isArray(value) && !(value instanceof Date)) {
      throw new Error(`Invalid event: property at path '${path}' is a complex class instance (${value.constructor?.name || 'UnknownClass'}), which is not allowed.`);
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        checkSerializable(value[i], `${path}[${i}]`);
      }
    } else if (value instanceof Date) {
      return;
    } else {
      for (const key of Object.keys(value)) {
        checkSerializable(value[key], path ? `${path}.${key}` : key);
      }
    }
  }
}

export function validateEvent(event: any): void {
  if (!event) {
    throw new Error('Invalid event: event is null or undefined.');
  }
  const mandatoryFields = ['eventId', 'event', 'version', 'occurredAt', 'source', 'payload'];
  for (const field of mandatoryFields) {
    if (event[field] === undefined || event[field] === null) {
      throw new Error(`Invalid event: mandatory field '${field}' is missing or null.`);
    }
  }
  if (typeof event.eventId !== 'string') throw new Error("Invalid event: 'eventId' must be a string.");
  if (typeof event.event !== 'string') throw new Error("Invalid event: 'event' must be a string.");
  if (typeof event.version !== 'number') throw new Error("Invalid event: 'version' must be a number.");
  if (typeof event.occurredAt !== 'string') throw new Error("Invalid event: 'occurredAt' must be a string.");
  if (typeof event.source !== 'string') throw new Error("Invalid event: 'source' must be a string.");
  
  checkSerializable(event);
}

export class ApplicationEventBus implements IApplicationEventBus {
  private listeners = new Map<string, Set<(event: any) => void>>();

  public publish<T extends keyof ApplicationEventPayloads>(event: ApplicationEvent<T>): void {
    validateEvent(event);
    const eventType = event.event;
    const targetListeners = this.listeners.get(eventType);
    if (!targetListeners) {
      return;
    }
    for (const listener of targetListeners) {
      try {
        listener(event);
      } catch (err) {
        // Silenciosamente captura erros de listeners individuais
      }
    }
  }

  public subscribe<T extends keyof ApplicationEventPayloads>(
    event: T,
    listener: (event: ApplicationEvent<T>) => void
  ): () => void {
    let targetListeners = this.listeners.get(event);
    if (!targetListeners) {
      targetListeners = new Set();
      this.listeners.set(event, targetListeners);
    }
    targetListeners.add(listener);

    return () => {
      const currentListeners = this.listeners.get(event);
      if (currentListeners) {
        currentListeners.delete(listener);
        if (currentListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }
}
