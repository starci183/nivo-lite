import { DELIVERY_OUTCOME_UNKNOWN, messageStampOf } from "./agent-messages.policy"

const NOW = Date.parse("2026-11-04T10:00:00.000Z")

describe("messageStampOf", () => {
    it("is the time the event says the message happened", () => {
        const sentAt = Date.parse("2026-11-04T00:50:12.345Z")

        expect(messageStampOf(sentAt, NOW, "zalo:m-1").at).toEqual(new Date(sentAt))
    })

    it("is never later than now, so a clock that runs ahead cannot put a message in the future", () => {
        expect(messageStampOf(NOW + 3_600_000, NOW, "zalo:m-1").at).toEqual(new Date(NOW))
    })

    it("tells messages of the same millisecond apart by a tie-break that is the same for the same id and stays under a millisecond", () => {
        const ids = ["zalo:m-1", "zalo:m-2", "zalo:m-3", "zalo:m-4", "zalo:m-5"]
        const ties = ids.map((id) => messageStampOf(NOW, NOW, id).tieMicros)

        expect(ties).toEqual(ids.map((id) => messageStampOf(NOW, NOW, id).tieMicros))
        expect(new Set(ties).size).toBeGreaterThan(1)
        for (const tie of ties) {
            expect(Number.isInteger(tie)).toBe(true)
            expect(tie).toBeGreaterThanOrEqual(0)
            expect(tie).toBeLessThan(1000)
        }
    })

    it("keeps a name for the delivery outcome that is not known", () => {
        expect(DELIVERY_OUTCOME_UNKNOWN).toBe("delivery_outcome_unknown")
    })
})
