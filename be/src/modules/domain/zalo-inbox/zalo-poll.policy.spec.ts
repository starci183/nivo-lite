import { ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ZALO_POLL_DEFAULTS, isStaleMessage, polledRawBody, pollRulesOf } from "./zalo-poll.policy"
import { zaloDeliveryIdOf } from "./zalo-delivery-id.policy"

const HOUR = 3_600_000
const NOW = Date.parse("2026-11-04T10:00:00.000Z")

describe("pollRulesOf", () => {
    it("takes the Zalo consultation window and a one day stale age when the options give none", () => {
        expect(pollRulesOf({})).toEqual({ replyWindowMs: ZALO_FREE_WINDOW_MS, staleAfterMs: 24 * HOUR })
        expect(ZALO_POLL_DEFAULTS.replyWindowMs).toBe(48 * HOUR)
    })

    it("lets the options override a default", () => {
        expect(pollRulesOf({ staleAfterMs: HOUR })).toEqual({ replyWindowMs: 48 * HOUR, staleAfterMs: HOUR })
    })
})

describe("isStaleMessage", () => {
    const rules = { replyWindowMs: 48 * HOUR, staleAfterMs: 24 * HOUR }

    it("answers a message younger than both limits", () => {
        expect(isStaleMessage(NOW - 23 * HOUR, NOW, rules)).toBe(false)
    })

    it("keeps a message older than the stale age for the owner", () => {
        expect(isStaleMessage(NOW - 25 * HOUR, NOW, rules)).toBe(true)
    })

    it("keeps a message older than the reply window for the owner even when the stale age is longer", () => {
        const longStale = { replyWindowMs: 48 * HOUR, staleAfterMs: 96 * HOUR }
        expect(isStaleMessage(NOW - 47 * HOUR, NOW, longStale)).toBe(false)
        expect(isStaleMessage(NOW - 49 * HOUR, NOW, longStale)).toBe(true)
    })

    it("treats a message exactly at the limit as still fresh", () => {
        expect(isStaleMessage(NOW - 24 * HOUR, NOW, rules)).toBe(false)
    })
})

describe("polledRawBody", () => {
    it("builds the body the webhook posts for a customer text, which gets the webhook delivery id", () => {
        const body = polledRawBody({ messageId: "m-1", userId: "user-1", text: "Alo", sentAt: 1_762_192_200_000 })

        expect(JSON.parse(body.toString("utf8"))).toEqual({
            event_name: "user_send_text",
            timestamp: "1762192200000",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: "Alo" },
        })
        expect(zaloDeliveryIdOf("c-1", body)).toBe("c-1:m-1")
    })
})
