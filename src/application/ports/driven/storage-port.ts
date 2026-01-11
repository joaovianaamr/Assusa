export interface StoragePort {
  get(key: string, requestId: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number, requestId?: string): Promise<void>;
  delete(key: string, requestId: string): Promise<void>;
  increment(key: string, requestId: string): Promise<number>;
  expire(key: string, ttlSeconds: number, requestId: string): Promise<void>;
}
