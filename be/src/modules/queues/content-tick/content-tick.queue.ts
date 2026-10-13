/** The queue name: the contract between the pg_cron scheduler of the content automations and the processor of the publish-content job (a pgmq queue name). */
export const CONTENT_TICK_QUEUE = "content_tick"

/** The payload of one content tick: the scheduler sends an empty one, an operator may name one workspace and force the run. */
export interface ContentTickPayload {
    /** Run the switched-on automations of this workspace only. */
    readonly workspaceId?: string
    /** Ignore the time window and the day or week marks (an operator check); honoured only together with `workspaceId`. */
    readonly force?: boolean
}

/** The id of the pg_cron scheduler that sends a content tick every quarter hour. */
export const CONTENT_TICK_SCHEDULER = "content-tick"

/** The pause between two content ticks. */
export const CONTENT_TICK_EVERY_MS = 15 * 60 * 1000

/** Reads a job payload as a content tick: unknown fields are dropped and a malformed field is ignored. */
export const contentTickPayloadOf = (value: object): ContentTickPayload => ({
    ...("workspaceId" in value && typeof value.workspaceId === "string" ? { workspaceId: value.workspaceId } : {}),
    ...("force" in value && value.force === true ? { force: true } : {}),
})
