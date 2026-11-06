import { inboxStatusOf, unansweredOf } from "../../../rules/chatbot"
import { chatbotModule } from "../declaration"
import {
    CHANNEL_COUNTS_DATA,
    CHATBOT_FIXTURES,
    HANDLED_VIEW,
    READY_LINES,
    STATUS_COUNTS,
    THREAD_ROWS,
    WAITING_LINES,
    WAITING_THREAD_ROWS,
    WAITING_VIEW,
} from "./chatbot.fixtures"

describe("the Chatbot fixtures", () => {
    it("hold every read and every action of the module, and only those", () => {
        expect(Object.keys(CHATBOT_FIXTURES.reads).toSorted()).toEqual(
            chatbotModule.reads.map((read) => read.id).toSorted(),
        )
        expect(Object.keys(CHATBOT_FIXTURES.actions).toSorted()).toEqual(
            chatbotModule.actions.map((action) => action.id).toSorted(),
        )
    })

    it("answer every action as done", () => {
        expect(Object.values(CHATBOT_FIXTURES.actions).every((result) => result.ok)).toBe(true)
    })

    it("hold ready for every read, and empty for the lists and counts", () => {
        for (const fixture of Object.values(CHATBOT_FIXTURES.reads)) expect(fixture.ready).toBeDefined()
        for (const id of ["chatbot.threads", "chatbot.thread-counts", "chatbot.channel-counts", "chatbot.messages"])
            expect(CHATBOT_FIXTURES.reads[id]?.empty).toBeDefined()
    })

    it("keep the marks of each conversation as the rules derive them", () => {
        for (const row of THREAD_ROWS) {
            expect(row.status).toBe(inboxStatusOf(row))
            expect(row.unanswered).toBe(unansweredOf(row))
        }
    })

    it("list the conversations newest activity first, one waiting for a person, one held and the rest with the AI", () => {
        const times = THREAD_ROWS.map((row) => row.lastAt ?? "")
        expect(times).toEqual(times.toSorted().toReversed())
        expect(THREAD_ROWS.map((row) => row.status)).toEqual(["needs", "handled", "ai", "ai"])
    })

    it("show only what waits for the owner in the waiting state", () => {
        expect(WAITING_THREAD_ROWS.every((row) => row.status === "needs")).toBe(true)
        expect(CHATBOT_FIXTURES.reads["chatbot.threads"]?.waiting).toEqual({ rows: WAITING_THREAD_ROWS, cursor: null })
        expect(CHATBOT_FIXTURES.reads["chatbot.messages"]?.waiting).toEqual({ rows: WAITING_LINES, cursor: null })
        expect(CHATBOT_FIXTURES.reads["chatbot.thread"]?.waiting).toBe(WAITING_VIEW)
        expect(WAITING_LINES.at(-1)?.side).toBe("incoming")
    })

    it("count the conversations as the rows are", () => {
        expect(STATUS_COUNTS.total).toBe(THREAD_ROWS.length)
        expect(CHANNEL_COUNTS_DATA.total).toBe(THREAD_ROWS.length)
        for (const status of ["needs", "handled", "ai"]) {
            expect(STATUS_COUNTS.counts[status]).toBe(THREAD_ROWS.filter((row) => row.status === status).length)
        }
        for (const [channel, count] of Object.entries(CHANNEL_COUNTS_DATA.counts)) {
            expect(THREAD_ROWS.filter((row) => row.channel === channel)).toHaveLength(count)
        }
    })

    it("draw a thread of a customer, the AI, a notice and a person, every line with a side", () => {
        expect(READY_LINES.map((line) => line.side)).toEqual(["incoming", "outgoing", "notice", "outgoing"])
        expect(READY_LINES.filter((line) => line.side === "notice").every((line) => line.who === "")).toBe(true)
    })

    it("show the customer pane of a conversation a person holds when ready", () => {
        expect(CHATBOT_FIXTURES.reads["chatbot.thread"]?.ready).toBe(HANDLED_VIEW)
        expect(HANDLED_VIEW).toMatchObject({ status: "handled", handledBy: "Thu Ha Le" })
    })
})
