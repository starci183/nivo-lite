import { questionQueueOf } from "./questions"

const ASKED = {
    id: "q1",
    text: "Which invoice is this payment for?",
    source: "HD-0139",
    askedAt: "2026-11-04T02:12:00.000Z",
}

describe("questionQueueOf", () => {
    it("draws each question with its source and an answer form to fill in", () => {
        const queue = questionQueueOf([ASKED], 3)
        expect(queue.count).toBe("3")
        expect(queue.rows[0]).toMatchObject({
            id: "q1",
            title: "Which invoice is this payment for?",
            description: "HD-0139",
            primary: null,
            edit: { id: "edit" },
            draft: { answer: "" },
            askedAt: "2026-11-04T02:12:00.000Z",
        })
    })

    it("has no count for an empty queue", () => {
        expect(questionQueueOf([], 0)).toEqual({ count: null, more: null, rows: [] })
    })
})
