/** The durable queue of the AI Marketing tick: due Zalo OA articles and the weekly report cards (pg_cron every quarter hour). */
export const MARKETING_TICK_QUEUE = "marketing_tick"

/** The payload of one marketing tick: the scheduler sends an empty one, an operator may name one workspace. */
export interface MarketingTickPayload {
    /** Run the weekly report of this workspace only. */
    readonly workspaceId?: string
}

/** Reads a job payload as a marketing tick: unknown fields are dropped and a malformed field is ignored. */
export const marketingTickPayloadOf = (value: object): MarketingTickPayload =>
    "workspaceId" in value && typeof value.workspaceId === "string" ? { workspaceId: value.workspaceId } : {}
