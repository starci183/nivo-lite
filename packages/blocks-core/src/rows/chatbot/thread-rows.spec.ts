import { THREAD_RECORDS } from "../../fixtures/chatbot/inbox.fixtures"
import { INBOX_TABS, threadRowsOf, threadStatusOf } from "./thread-rows"

const WORDS = { untitled: "Visitor", byPerson: "You: ", byAi: "AI: " }

describe("threadStatusOf", () => {
    it("knows the three states and nothing else", () => {
        expect(["needs", "handled", "ai"].map(threadStatusOf)).toEqual(["needs", "handled", "ai"])
        expect(threadStatusOf("closed")).toBeNull()
        expect(threadStatusOf("")).toBeNull()
    })
})

describe("threadRowsOf", () => {
    const rows = threadRowsOf(THREAD_RECORDS, WORDS) ?? []

    it("draws a row per conversation with its name, last words, time, status and channel", () => {
        expect(rows).toHaveLength(4)
        expect(rows[0]).toEqual({
            id: "t1",
            name: THREAD_RECORDS[0]?.name,
            preview: THREAD_RECORDS[0]?.lastText,
            at: "2026-11-06T01:58:00.000Z",
            status: "needs",
            handledBy: "",
            channel: "zalo",
        })
    })

    it("leads the agent's last words with the AI, or with you when a person holds the conversation", () => {
        expect(rows[1]?.preview).toBe(`AI: ${THREAD_RECORDS[1]?.lastText}`)
        expect(rows[2]?.preview).toBe(`You: ${THREAD_RECORDS[2]?.lastText}`)
        expect(rows[2]?.handledBy).toBe(THREAD_RECORDS[2]?.handledBy)
    })

    it("names an unnamed visitor so a row never has an empty title", () => {
        expect(rows[3]?.name).toBe("Visitor")
    })

    it("leaves out a record without an id and answers null when no row can be drawn", () => {
        expect(threadRowsOf([{ name: "no id" }], WORDS)).toBeNull()
        expect(threadRowsOf([], WORDS)).toBeNull()
        expect(threadRowsOf([{ id: "x" }, { name: "no id" }], WORDS)).toEqual([
            { id: "x", name: "Visitor", preview: "", at: "", status: null, handledBy: "", channel: "" },
        ])
    })
})

describe("INBOX_TABS", () => {
    it("adds the tabs for the conversations that need a person and the ones of today to the all tab", () => {
        expect(INBOX_TABS).toEqual(["needs", "today"])
    })
})
