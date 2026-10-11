import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/**
 * Keeps data of the current request (its id) available to any code running
 * while the request is handled, without passing it around as a parameter.
 */
export const RequestContext = {
  run<T>(store: RequestContextStore, callback: () => T): T {
    return storage.run(store, callback);
  },

  getRequestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
};
