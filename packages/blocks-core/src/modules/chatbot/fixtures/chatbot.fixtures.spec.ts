import { chatMarkOf, inboxStatusOf } from "../../../rules/chatbot"
import { chatbotModule } from "../declaration"
import {
    CHANNEL_COUNTS_DATA,
    CHATBOT_FIXTURES,
    HANDLED_VIEW,
    LISTED_ROWS,
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
        for (const id of [
            "blocks-core.chatbot.api.chat.list",
            "blocks-core.chatbot.api.chat.status-counts",
            "blocks-core.chatbot.api.chat.channel-counts",
            "blocks-core.chatbot.api.message.list",
        ])
            expect(CHATBOT_FIXTURES.reads[id]?.empty).toBeDefined()
    })

    // Design change (owner ruling R26): `unanswered` is the chatbot's own stored mark (hear sets it, a reply clears it), no longer derived
    // from a stored last role; only the status follows from the state.
    // Design change (ruling R43): the chat stores only its open question's mark (`needs` / `ai`); `handled` is shown from the engine's
    // route hold, joined by the list read (`LISTED_ROWS`).
    it("keep the stored mark of each conversation as the rules derive it, and show a held route as handled", () => {
        for (const row of THREAD_ROWS) expect(row.status).toBe(chatMarkOf(row.waiting))
        expect(LISTED_ROWS.map((row) => row.status)).toEqual(["needs", "handled", "ai", "ai"])
        expect(LISTED_ROWS.map((row) => row.status)).toEqual(LISTED_ROWS.map((row) => inboxStatusOf({ waiting: row.waiting, held: row.handledBy !== "" })))
    })

    it("list the conversations newest activity first, one waiting for a person, one held and the rest with the AI", () => {
        const times = THREAD_ROWS.map((row) => row.lastAt ?? "")
        expect(times).toEqual(times.toSorted().toReversed())
        expect(THREAD_ROWS.map((row) => row.status)).toEqual(["needs", "ai", "ai", "ai"])
    })

    it("show only what waits for the owner in the waiting state", () => {
        expect(WAITING_THREAD_ROWS.every((row) => row.status === "needs")).toBe(true)
        expect(CHATBOT_FIXTURES.reads["blocks-core.chatbot.api.chat.list"]?.waiting).toEqual({
            rows: WAITING_THREAD_ROWS,
            cursor: null,
        })
        expect(CHATBOT_FIXTURES.reads["blocks-core.chatbot.api.message.list"]?.waiting).toEqual({
            rows: WAITING_LINES,
            cursor: null,
        })
        expect(CHATBOT_FIXTURES.reads["blocks-core.chatbot.api.chat.get"]?.waiting).toBe(WAITING_VIEW)
        expect(WAITING_LINES.at(-1)?.side).toBe("incoming")
    })

    it("count the conversations as the rows are", () => {
        expect(STATUS_COUNTS.total).toBe(THREAD_ROWS.length)
        expect(CHANNEL_COUNTS_DATA.total).toBe(THREAD_ROWS.length)
        for (const status of ["needs", "ai"]) {
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
        expect(CHATBOT_FIXTURES.reads["blocks-core.chatbot.api.chat.get"]?.ready).toBe(HANDLED_VIEW)
        expect(HANDLED_VIEW).toMatchObject({ status: "handled", handledBy: "Thu Ha Le" })
    })
})
