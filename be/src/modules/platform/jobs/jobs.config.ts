import type { EnvSource } from "@modules/platform/config"
import type { JobsOptions } from "./jobs.options"

/** What the app's `main.ts` reads for the jobs; the connection token is the app root's choice. */
export type JobsConfig = Omit<JobsOptions, "connection">

/** Reads the jobs options: all are tunables with literal defaults. */
export const parseJobsConfig = (env: EnvSource): JobsConfig => ({
    workerId: env.optional("JOBS_WORKER_ID") ?? "worker",
    leaseMs: env.duration("JOBS_LEASE", 60000),
    scheduler: { enabled: env.bool("JOBS_SCHEDULER_ENABLED", true) },
})
