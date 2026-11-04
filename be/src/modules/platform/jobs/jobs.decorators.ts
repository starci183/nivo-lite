import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims, JobProcessorRegistry, JobTickScheduler } from "./jobs.port"
import type { JobFenceService } from "./job-fence.service"

/** Token of the options of the jobs, exported so a spec can provide it. */
export const JOBS_OPTIONS: unique symbol = Symbol("platform.jobs.options")

/** Token of the JobClaims port. */
export const JOB_CLAIMS: unique symbol = Symbol("platform.jobs.claims")

/** Token of the transactional fenced writer. */
export const JOB_FENCE: unique symbol = Symbol("platform.jobs.fence")

/** Token of the registry a job module registers its processor with. */
export const JOB_PROCESSOR_REGISTRY: unique symbol = Symbol("platform.jobs.processor-registry")

/** Token of the entity managers of the connections that hold the job table, in the order the options name them. */
export const JOBS_MANAGERS: unique symbol = Symbol("platform.jobs.managers")

/** Token of the scheduler that fires the ticks on their cron schedules. */
export const JOB_TICK_SCHEDULER: unique symbol = Symbol("platform.jobs.tick-scheduler")

/** Injects the options of the jobs. Parameter type: JobsOptions. */
export const InjectJobsOptions = (): TypedParameterDecorator<JobsOptions> => injector<JobsOptions>(JOBS_OPTIONS)

/** Injects the JobClaims port. Parameter type: JobClaims. */
export const InjectJobClaims = (): TypedParameterDecorator<JobClaims> => injector<JobClaims>(JOB_CLAIMS)

/** Injects the transactional fenced writer. Parameter type: JobFenceService. */
export const InjectJobFence = (): TypedParameterDecorator<JobFenceService> => injector<JobFenceService>(JOB_FENCE)

/** Injects the processor registry. Parameter type: JobProcessorRegistry. */
export const InjectJobProcessorRegistry = (): TypedParameterDecorator<JobProcessorRegistry> =>
    injector<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)

/** Injects the entity managers of the connections that hold the job table. Parameter type: ReadonlyArray<EntityManager>. */
export const InjectJobsManagers = (): TypedParameterDecorator<ReadonlyArray<EntityManager>> =>
    injector<ReadonlyArray<EntityManager>>(JOBS_MANAGERS)

/** Injects the scheduler that fires the ticks. Parameter type: JobTickScheduler. */
export const InjectJobTickScheduler = (): TypedParameterDecorator<JobTickScheduler> =>
    injector<JobTickScheduler>(JOB_TICK_SCHEDULER)
