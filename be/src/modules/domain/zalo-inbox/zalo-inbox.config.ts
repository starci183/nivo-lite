import type { EnvSource } from "@modules/platform/config"
import type { ZaloInboxOptions } from "./zalo-inbox.options"
import { ZALO_POLL_DEFAULTS } from "./zalo-poll.policy"

/**
 * Reads the Zalo reconcile rules: ZALO_REPLY_WINDOW (Zalo's consultation window, 48 hours), ZALO_STALE_AFTER (the age past which a polled
 * message goes to the owner instead of an agent) and ZALO_BACKFILL (how far back a connection's first run reads, 7 days).
 */
export const parseZaloInboxConfig = (env: EnvSource): ZaloInboxOptions => ({
    replyWindowMs: env.duration("ZALO_REPLY_WINDOW", ZALO_POLL_DEFAULTS.replyWindowMs),
    staleAfterMs: env.duration("ZALO_STALE_AFTER", ZALO_POLL_DEFAULTS.staleAfterMs),
    backfillMs: env.duration("ZALO_BACKFILL", ZALO_POLL_DEFAULTS.backfillMs),
})
