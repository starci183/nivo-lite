import type { EnvSource } from "@modules/platform/config"
import type { ZaloProviderOptions } from "./zalo-provider.options"
import { ZALO_POLL_DEFAULTS } from "./zalo-poll.policy"

/**
 * Reads the Zalo reconcile rules: ZALO_REPLY_WINDOW (Zalo's consultation window, 48 hours) and ZALO_STALE_AFTER (the age past which a polled
 * message goes to the owner instead of an agent, 24 hours); the shorter of the two decides.
 */
export const parseZaloProviderConfig = (env: EnvSource): ZaloProviderOptions => ({
    replyWindowMs: env.duration("ZALO_REPLY_WINDOW", ZALO_POLL_DEFAULTS.replyWindowMs),
    staleAfterMs: env.duration("ZALO_STALE_AFTER", ZALO_POLL_DEFAULTS.staleAfterMs),
})
