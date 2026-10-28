/** The Zalo capability codes the console words itself (`extensions.code` of a failed operation). */
const ZALO_CODES: ReadonlySet<string> = new Set([
    "ZALO_UNAVAILABLE",
    "ZALO_REJECTED",
    "ZALO_BODY_UNREADABLE",
    "ZALO_WINDOW_CLOSED",
    "ZALO_NOT_FOLLOWER",
    "ZALO_NIGHT_HOURS",
    "ZALO_TOKEN_REJECTED",
    "ZALO_RECIPIENT_UNREACHABLE",
    "ZALO_TEMPLATE_REJECTED",
    "ZALO_QUOTA_EXHAUSTED",
    "ZALO_NOT_PERMITTED",
    "CHANNELS_ZALO_NOT_AUTHORIZED",
    "CHANNELS_ZALO_REFRESH_BUSY",
    "CHANNELS_ZALO_STATE_REJECTED",
    "CHANNELS_ZALO_STATE_EXPIRED",
])

/** The stable failure terms of a Zalo send (what a delivery answers with when Zalo did not take the message). */
const ZALO_FAILURES: ReadonlySet<string> = new Set([
    "zalo_window_expired",
    "zalo_unfollowed",
    "zalo_night_hours",
    "zalo_token",
    "zalo_not_connected",
    "zalo_recipient",
    "zalo_template",
    "zalo_quota",
    "zalo_not_permitted",
    "zalo_error",
])

/**
 * The key, in the `zalo` catalog, that words one Zalo error code or send failure; undefined when the console has no words for it
 * (the caller then keeps the back end message).
 */
export const zaloFailureKeyOf = (codeOrFailure: string | undefined): string | undefined =>
    codeOrFailure !== undefined && (ZALO_CODES.has(codeOrFailure) || ZALO_FAILURES.has(codeOrFailure))
        ? `err_${codeOrFailure}`
        : undefined

/** The verdict the Connections address carries after a Zalo sign-in that did not work: an old state is `expired`, a refusal `denied`. */
export const zaloReturnVerdictOf = (code: string | undefined, isRefused: boolean): "expired" | "denied" | "failed" => {
    if (code === "CHANNELS_ZALO_STATE_EXPIRED") return "expired"
    return isRefused ? "denied" : "failed"
}
