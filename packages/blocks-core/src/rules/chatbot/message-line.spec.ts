import { AI_AUTHOR, threadLineOf } from "./message-line"
import type { StoredLine } from "./message-line"

const LINE: StoredLine = {
    id: "m1",
    role: "user",
    text: "Hi",
    sentAt: "2026-11-05T01:00:00.000Z",
    authorKind: null,
    authorName: null,
    deliveryStatus: null,
    sentBy: null,
}

describe("threadLineOf", () => {
    it("draws the customer's line as incoming under the name the inbox shows", () => {
        expect(threadLineOf(LINE, "Minh")).toEqual({
            id: "m1",
            text: "Hi",
            who: "Minh",
            at: "2026-11-05T01:00:00.000Z",
            side: "incoming",
            state: "",
            mark: "",
            sentBy: "",
        })
    })

    it("tells which agent sent an agent line, and nothing for a line no agent sent", () => {
        const sent: StoredLine = { ...LINE, role: "agent", authorKind: "ai", sentBy: "agent-sales" }

        expect(threadLineOf(sent, "Minh").sentBy).toBe("agent-sales")
        expect(threadLineOf(LINE, "Minh").sentBy).toBe("")
    })

    it("draws the AI's pushed line as outgoing, sent, marked AI, under its own name or the default", () => {
        const sent: StoredLine = { ...LINE, role: "agent", authorKind: "ai", deliveryStatus: "sent" }
        expect(threadLineOf(sent, "Minh")).toMatchObject({
            who: AI_AUTHOR,
            side: "outgoing",
            state: "sent",
            mark: "AI",
        })
        expect(threadLineOf({ ...sent, authorName: "Nivo" }, "Minh").who).toBe("Nivo")
    })

    it("draws a person's line under their name, queued until it is pushed, with no AI mark", () => {
        const reply: StoredLine = { ...LINE, role: "agent", authorKind: "human", authorName: "Ha" }
        expect(threadLineOf(reply, "Minh")).toMatchObject({ who: "Ha", side: "outgoing", state: "queued", mark: "" })
        expect(threadLineOf({ ...reply, deliveryStatus: "failed" }, "Minh").state).toBe("failed")
    })

    it("draws a system line as a notice with no author", () => {
        expect(threadLineOf({ ...LINE, role: "system", text: "Ha took over" }, "Minh")).toMatchObject({
            who: "",
            side: "notice",
            state: "",
            mark: "",
        })
    })
})
