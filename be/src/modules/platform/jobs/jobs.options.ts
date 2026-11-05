import type { InjectionToken } from "@nestjs/common"
import type { JobsSchedulerOptions } from "./types/jobs-scheduler.options"

/** What the jobs of one app need: the connection that holds the job table, who this worker is, and how long a claim lasts. */
export interface JobsOptions {
    /** The token of the shared entity manager of the connection that holds the job table of the app. */
    readonly connection: InjectionToken
    /** The name this worker writes into `claimed_by`; it tells operators who held a job, the fence never reads it. */
    readonly workerId: string
    /** How long a claim lasts: after it a stalled job may be claimed again, and the old worker is fenced out. */
    readonly leaseMs: number
    /** Names the running build (a git sha or a release tag); a job parked under another build is handed back to its queue when this one starts. Without it no job is resumed by a build change. */
    readonly buildId?: string | undefined
    /** The recurring ticks of the app. */
    readonly scheduler: JobsSchedulerOptions
}
