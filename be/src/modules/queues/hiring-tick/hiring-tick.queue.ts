/** The queue name: the contract between the database function that sends one job per workspace every five minutes and the processor of the hiring-tick job (a pgmq queue name). */
export const HIRING_TICK_QUEUE = "hiring_tick"

/** The payload of one hiring-tick job: the workspace whose hiring is ticked. */
export interface HiringTickPayload {
    /** The workspace. */
    readonly workspaceId: string
}

/** True when a job payload is the payload of a hiring-tick job. */
export const isHiringTickPayload = (value: unknown): value is HiringTickPayload =>
    typeof value === "object" && value !== null && "workspaceId" in value && typeof value.workspaceId === "string"
