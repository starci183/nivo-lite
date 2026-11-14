import { chatDecisionQueueOf } from "./decisions"

describe("chatDecisionQueueOf", () => {
    it("draws each waiting conversation with the last words of the customer and a take-over command", () => {
        const queue = chatDecisionQueueOf(
            [
                { id: "c1", name: "Thu", channel: "zalo", lastText: "Open on day 2?" },
                { id: "c2", name: "", channel: "website", lastText: "Price?" },
            ],
            4,
        )
        expect(queue.count).toBe("4")
        expect(queue.rows.map((row) => row.title)).toEqual(["Thu", "website"])
        expect(queue.rows[0]).toMatchObject({ description: "Open on day 2?", primary: { id: "handoff" }, menu: [] })
    })

    it("has no count when nobody waits", () => {
        expect(chatDecisionQueueOf([], 0)).toEqual({ count: null, more: null, rows: [] })
    })
})
