import { DynamicModule, Global, Module } from "@nestjs/common";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";
import { JobProducer } from "./job-producer.service";
import { JobRegistry } from "./job-registry.service";
import { OutboxRelayService } from "./outbox-relay.service";
import { QueueTransport } from "./queue-transport.service";
import { RedisConnection } from "./redis.connection";
import { WorkspaceSemaphore } from "./workspace-semaphore";

/**
 * Background jobs over BullMQ (docs/JOBS.md): the outbox relay (job_outbox -> Redis), the worker registry that feature modules register their
 * handlers in, the producer (job_enqueue) for chained jobs, and the Redis connection with its health probe. Global: a feature module only
 * injects JobRegistry / JobProducer. bullmq and ioredis are imported nowhere else in the engine.
 * The old engine_jobs queue (platform/queue, OpenClaw work) is separate and keeps running.
 */
@Global()
@Module({})
export class BullmqModule {
  static register(options: BullmqOptions): DynamicModule {
    return {
      module: BullmqModule,
      providers: [{ provide: BULLMQ_OPTIONS, useValue: options }, RedisConnection, WorkspaceSemaphore, QueueTransport, OutboxRelayService, JobProducer, JobRegistry],
      exports: [BULLMQ_OPTIONS, RedisConnection, WorkspaceSemaphore, QueueTransport, OutboxRelayService, JobProducer, JobRegistry],
    };
  }
}
