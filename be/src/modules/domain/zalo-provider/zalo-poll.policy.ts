import { ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import type { ZaloProviderOptions } from "./zalo-provider.options"

const DAY_MS = 86_400_000

/** The reconcile rules with every default filled in. */
export type ZaloPollRules = Required<ZaloProviderOptions>

/** Zalo lets the OA reply as a consultation message for 48 hours after the customer's last message; a day-old message is stale for an agent. */
export const ZALO_POLL_DEFAULTS: ZaloPollRules = {
    replyWindowMs: ZALO_FREE_WINDOW_MS,
    staleAfterMs: DAY_MS,
}

/** How many conversations or messages one Zalo list call reads (the most the open API allows). */
export const ZALO_POLL_PAGE_SIZE = 10

/** The most pages one list is walked, so a run is bounded. */
export const ZALO_POLL_MAX_PAGES = 30

/** The pause between two Zalo calls, in milliseconds, to stay inside the rate limit of the open API. */
export const ZALO_POLL_PAUSE_MS = 400

/** The rules the options give, the defaults where they give none. */
export const pollRulesOf = (options: ZaloProviderOptions): ZaloPollRules => ({ ...ZALO_POLL_DEFAULTS, ...options })

/**
 * True when a message must not be answered by an agent: it is older than the reply window (Zalo would refuse or charge the reply) or older
 * than the stale age (the customer has long stopped waiting), whichever is shorter.
 */
export const isStaleMessage = (sentAt: number, now: number, rules: ZaloPollRules): boolean =>
    now - sentAt > Math.min(rules.replyWindowMs, rules.staleAfterMs)
