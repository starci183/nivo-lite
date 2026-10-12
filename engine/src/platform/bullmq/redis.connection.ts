import { Inject, Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";

export type RedisHealth = { readonly configured: boolean; readonly ok: boolean; readonly latencyMs: number | null; readonly error: string | null };

/**
 * The one Redis client of the engine (BullMQ duplicates it for its blocking connections). Null when REDIS_URL is not set: the BullMQ
 * capability is then off and only the outbox accumulates jobs. The URL (which may hold a password) is never logged.
 */
@Injectable()
export class RedisConnection implements OnApplicationShutdown {
  private readonly log = new Logger("redis");
  readonly client: Redis | null;

  constructor(@Inject(BULLMQ_OPTIONS) options: BullmqOptions) {
    this.client = options.redisUrl
      ? new Redis(options.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false, connectionName: "nivo-engine" })
      : null;
    let lastError = "";
    this.client?.on("error", (e: Error) => {
      if (e.message !== lastError) this.log.warn(`redis error: ${e.message}`);
      lastError = e.message;
    });
    this.client?.on("ready", () => {
      lastError = "";
      this.log.log("redis ready");
    });
  }

  /** PING with a short timeout, for /readyz. */
  async health(): Promise<RedisHealth> {
    if (!this.client) return { configured: false, ok: false, latencyMs: null, error: null };
    const t0 = Date.now();
    try {
      await Promise.race([this.client.ping(), new Promise((_, reject) => setTimeout(() => reject(new Error("ping timeout")), 1_500))]);
      return { configured: true, ok: true, latencyMs: Date.now() - t0, error: null };
    } catch (e) {
      return { configured: true, ok: false, latencyMs: null, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.quit().catch(() => this.client?.disconnect());
  }
}
