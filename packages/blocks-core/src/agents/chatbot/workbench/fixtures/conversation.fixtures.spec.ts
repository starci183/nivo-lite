import { entriesOf, messagesOf } from "../rows/conversation"
import {
    CONVERSATION_FIXTURES,
    CONVERSATION_PATHS,
    READY_CONVERSATION,
    SENDING_CONVERSATION,
} from "./conversation.fixtures"

describe("the conversation fixtures", () => {
    it("holds the eight states of a thread", () => {
        expect(Object.keys(CONVERSATION_FIXTURES)).toEqual([
            "ready",
            "empty",
            "loading",
            "error",
            "sending",
            "failed",
            "handedOff",
            "waitingForOwner",
        ])
    })

    it("yields messages through the paths for every state that has items", () => {
        const withItems = Object.values(CONVERSATION_FIXTURES).flatMap((fixture) =>
            "items" in fixture.slot ? [fixture.slot.items] : [],
        )
        expect(withItems).toHaveLength(5)
        for (const items of withItems) {
            expect(messagesOf(items, CONVERSATION_PATHS)?.length).toBe(items.length)
        }
    })

    it("spans two days with the assistant's replies marked and delivered", () => {
        const items = "items" in READY_CONVERSATION.slot ? READY_CONVERSATION.slot.items : []
        const rows = messagesOf(items, CONVERSATION_PATHS) ?? []
        expect(entriesOf(rows, "UTC").filter((entry) => entry.kind === "day")).toHaveLength(2)
        expect(rows.filter((row) => row.mark === "AI").map((row) => row.delivery)).toEqual(["sent", "sent"])
    })

    it("keeps the old messages while a send is in flight", () => {
        expect(SENDING_CONVERSATION.pending.map((entry) => entry.state)).toEqual(["sending"])
        expect("items" in SENDING_CONVERSATION.slot).toBe(true)
    })

    it("closes the controls a state takes away", () => {
        expect(CONVERSATION_FIXTURES["handedOff"]?.canHandoff).toBe(false)
        expect(CONVERSATION_FIXTURES["waitingForOwner"]?.canSend).toBe(false)
    })
})
