import { Inject, Injectable } from "@nestjs/common";
import { PermanentJobError } from "../queue/queue.types";
import { NIVO_OPTIONS, type NivoOptions } from "./nivo.config";
import { signBody } from "./signing";

/** The app answered with an error. 4xx (except 408/429) will not change on retry. */
export class NivoHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

/**
 * The engine signed calls to the Next.js control plane (/api/engine/*). Every body is HMAC-signed with the shared secret; the app
 * derives the workspace from the job id and rejects calls for jobs that are not running, so nothing here can name a tenant.
 */
@Injectable()
export class NivoClient {
  constructor(@Inject(NIVO_OPTIONS) private readonly options: NivoOptions) {}

  async call<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const raw = JSON.stringify(body);
    const timestamp = String(Date.now());
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-engine-timestamp": timestamp, "x-engine-signature": signBody(this.options.sharedSecret, timestamp, raw) },
      body: raw,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const text = await res.text();
    if (!res.ok) throw new NivoHttpError(res.status, `${path} -> ${res.status} ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new PermanentJobError(`${path} returned a body that is not JSON`);
    }
  }
}
