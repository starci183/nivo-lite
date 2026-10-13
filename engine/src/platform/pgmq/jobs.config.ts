import type { EnvSource } from "../config/env.source"

/** What main.ts reads for the background jobs on Supabase Queues (pgmq, docs/JOBS.md). */
export type JobsOptions = {
    /** JOBS_ENABLED=0 turns the consumer off (producers still enqueue; messages wait in pgmq). */
    readonly enabled: boolean
    /** Pause between polls when the last read found nothing (a finished job wakes the poller at once). */
    readonly pollMs: number
    /** Visibility timeout of a read message, seconds; a running handler extends it every third of it. */
    readonly visibilitySeconds: number
    /** Jobs one engine process runs at a time, across all workspaces. */
    readonly concurrency: number
    /** Jobs of ONE workspace running at a time across every engine (job_slots), so one workspace cannot starve the others. */
    readonly workspaceConcurrency: number
    /** How long running jobs get to finish on shutdown before they are handed back. */
    readonly shutdownGraceMs: number
}

export const JOBS_OPTIONS = Symbol("JOBS_OPTIONS")

export const parseJobsConfig = (env: EnvSource): JobsOptions => ({
    enabled: env.bool("JOBS_ENABLED", true),
    pollMs: env.int("JOBS_POLL_MS", 1500, { min: 200, max: 60_000 }),
    visibilitySeconds: env.int("JOBS_VT_SECONDS", 60, { min: 15, max: 3600 }),
    concurrency: env.int("JOBS_CONCURRENCY", 4, { min: 1, max: 64 }),
    workspaceConcurrency: env.int("JOBS_WORKSPACE_CONCURRENCY", 2, { min: 1, max: 64 }),
    shutdownGraceMs: env.int("ENGINE_SHUTDOWN_GRACE_MS", 30_000, { min: 0, max: 600_000 }),
})
