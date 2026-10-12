import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { Queue } from "bullmq";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";
import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED, KEEP_FAILED } from "./bullmq.policy";
import { bullmqJobId } from "./contracts";
import { RedisConnection } from "./redis.connection";

/** The producing side of BullMQ: the only place a job is added (by the relay). Every job gets the policy's attempts, backoff and retention. */
@Injectable()
export class QueueTransport implements OnApplicationShutdown {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly redis: RedisConnection, @Inject(BULLMQ_OPTIONS) private readonly options: BullmqOptions) {}

  queueOf(name: string): Queue {
    const known = this.queues.get(name);
    if (known) return known;
    const client = this.redis.client;
    if (!client) throw new Error("REDIS_URL is not set");
    const queue = new Queue(name, { connection: client, prefix: this.options.prefix });
    this.queues.set(name, queue);
    return queue;
  }

  /** Adds the job with the deterministic id of its dedupe key: adding the same row twice leaves one job. */
  async add(queue: string, name: string, payload: unknown, dedupe: string): Promise<void> {
    await this.queueOf(queue).add(name, payload, {
      jobId: bullmqJobId(dedupe),
      attempts: ATTEMPTS,
      backoff: { type: "exponential", delay: BACKOFF_MS },
      removeOnComplete: { ...KEEP_COMPLETED },
      removeOnFail: { ...KEEP_FAILED },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
  }
}
