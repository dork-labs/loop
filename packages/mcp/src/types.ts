import type { KyInstance } from 'ky';

export interface LoopMcpConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface ApiClientConfig {
  apiKey: string;
  apiUrl: string;
}

export type ApiClient = KyInstance;
