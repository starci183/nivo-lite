import { DynamicModule, Global, Module } from "@nestjs/common";
import { JOBS_OPTIONS, type JobsOptions } from "./jobs.config";
import { JobProducer } from "./job-producer.service";
import { JobRegistry } from "./job-registry.service";

/**
 * Background jobs on Supabase Queues (pgmq, docs/JOBS.md): the consumer registry that feature modules register their handlers in, and the
 * producer (job_enqueue) for chained jobs. Global: a feature module only injects JobRegistry / JobProducer. Everything goes through the
 * service-role Supabase client (RPCs job_*); no other infrastructure. The old engine_jobs queue (platform/queue, OpenClaw work) is separate.
 */
@Global()
@Module({})
export class JobsModule {
  static register(options: JobsOptions): DynamicModule {
    return {
      module: JobsModule,
      providers: [{ provide: JOBS_OPTIONS, useValue: options }, JobProducer, JobRegistry],
      exports: [JOBS_OPTIONS, JobProducer, JobRegistry],
    };
  }
}
