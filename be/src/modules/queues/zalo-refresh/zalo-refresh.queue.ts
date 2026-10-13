import type { QueueSchedulerDefinition } from "@modules/platform/queue"

/** The queue name: the contract between the scheduler below and the processor of the refresh-zalo-tokens job (a pgmq queue name). */
export const ZALO_REFRESH_QUEUE = "zalo_refresh"

/** The payload of one tick: how far ahead of its end an access token is renewed. */
export interface ZaloRefreshPayload {
    /** Milliseconds: a token that ends within this time is renewed. */
    readonly withinMs: number
}

/** True when a job payload is the payload of a Zalo refresh tick. */
export const isZaloRefreshPayload = (value: unknown): value is ZaloRefreshPayload =>
    typeof value === "object" && value !== null && "withinMs" in value && typeof value.withinMs === "number"

/** Every 6 hours every Zalo OA whose access token ends within 7 hours is renewed, which also keeps the 3-month refresh token rolling. */
export const ZALO_REFRESH_SCHEDULER: QueueSchedulerDefinition = {
    queue: ZALO_REFRESH_QUEUE,
    id: "zalo-refresh-tick",
    everyMs: 6 * 3_600_000,
    payload: { withinMs: 7 * 3_600_000 } satisfies ZaloRefreshPayload,
}
