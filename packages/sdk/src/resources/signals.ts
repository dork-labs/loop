import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { IngestSignalParams, DataResponse, SignalIngestResponse } from '@dork-labs/loop-types';

/**
 * Signals resource — ingest external data (PostHog, GitHub, Sentry, etc.)
 * into the Loop feedback pipeline.
 */
export class SignalsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Ingest a signal. Creates a signal record and a linked triage issue.
   *
   * @param params - Signal data including source, type, severity, and payload
   * @param options - Per-request overrides
   */
  async ingest(
    params: IngestSignalParams,
    options?: RequestOptions
  ): Promise<SignalIngestResponse> {
    const response = await this.http
      .post('api/signals', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<SignalIngestResponse>>();
    return response.data;
  }
}
