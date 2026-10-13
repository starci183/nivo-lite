/** The queue name: the contract between the database function the front end calls and the processor of the complete-zalo-authorization job (a pgmq queue name). */
export const ZALO_AUTHORIZATION_QUEUE = "zalo_authorization"

/** The payload of one complete-zalo-authorization job, written by the `zalo_authorization_return` database function. */
export interface ZaloAuthorizationPayload {
    /** The workspace the signed-in owner or manager proved membership of. */
    readonly workspaceId: string
    /** What Zalo sent the browser back with: the connection id and the one-time nonce. */
    readonly state: string
    /** The one-time authorization code to exchange for tokens. */
    readonly code: string
    /** The OA id Zalo reported, or null when it did not. */
    readonly oaId: string | null
}

/** True when a job payload is the payload of a complete-zalo-authorization job. */
export const isZaloAuthorizationPayload = (value: unknown): value is ZaloAuthorizationPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "state" in value &&
    typeof value.state === "string" &&
    "code" in value &&
    typeof value.code === "string" &&
    "oaId" in value &&
    (value.oaId === null || typeof value.oaId === "string")
