import { isRecord } from "@modules/platform/primitives"

/** The durable queue of the jobs the modules declare (`defineJob`). */
export const MODULE_JOBS_QUEUE = "module_jobs"

/** The job run by the module-jobs consumer. */
export const RUN_MODULE_JOB = "module-jobs.run"

/** The address of one declared job run: ids only, the workspace of the scope that enqueued it. */
export interface ModuleJobPayload {
    /** The workspace of the scope the job was enqueued in; the processor opens the same scope. */
    readonly workspaceId: string
    /** The declared job name, `<module>.<job>`. */
    readonly job: string
    /** The job's input: ids, enums and bounded strings only, parsed by the job's declaration before it runs. */
    readonly input: Readonly<Record<string, unknown>>
}

/** How one delivery is written: the identity of the job and a delay. */
export interface ModuleJobEnqueueOptions {
    /** The same key for the same job is one delivery; a fresh identity when absent. */
    readonly dedupeKey?: string | undefined
    /** The wait before the broker runs the job, milliseconds. */
    readonly delayMs?: number | undefined
}

/** True for a delivery that addresses a declared job run. */
export const isModuleJobPayload = (value: unknown): value is ModuleJobPayload =>
    isRecord(value) && typeof value.workspaceId === "string" && typeof value.job === "string" && isRecord(value.input)
