/** The queue name: the contract between the migration tick and the processor of the refresh-zalo-tokens job (a pgmq queue name). */
export const ZALO_REFRESH_QUEUE = "zalo_refresh"

/** The payload of one tick: how far ahead of its end an access token is renewed. */
export interface ZaloRefreshPayload {
    /** Milliseconds: a token that ends within this time is renewed. */
    readonly withinMs: number
}

/** True when a job payload is the payload of a Zalo refresh tick. */
export const isZaloRefreshPayload = (value: unknown): value is ZaloRefreshPayload =>
    typeof value === "object" && value !== null && "withinMs" in value && typeof value.withinMs === "number"
