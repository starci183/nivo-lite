import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ANSWER, CONV, UNDERSTAND, WS, customerWrites, drain, processOf, stopsOf, threadDbOf } from "./thread-world"

// The world's desk installed beside the core (as stops.spec.ts).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([desk.DESK_PLUGIN], "world-desk") }
})

// R74 / item 6 (QUEUE-DESIGN A.6 (a)): when the channel timed out or failed AFTER the request left, the customer send was recorded
// "outcome unknown" and handed back to the node AS A SUCCESS: the step completed as if it had answered; no card, nothing re-sent.
// General rule: a tool call whose outcome is unknown is never returned to the step as a success.

const REPLY = "Shop mo cua tu 8h den 21h a."
const sends = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })


// QUEUE-BUILD rule Q-3 (R74, R80/R81): the customer send DECLARES itself `repeatable`, so its unknown outcome is no stop: the run parks on
// the step (rule Q-2) and the step runs again after the pause, sending under the SAME key (the send ledger takes the ended-unknown key
// back); the worst case is a duplicate line. The second kind of workflow (a write that is not repeatable) is `retry-park.spec.ts`.

/** The thread's park question, when it is parked. */
const parkOf = async (process: Awaited<ReturnType<typeof processOf>>, runId: string): Promise<Record<string, unknown> | null> => {
    const view = await process.threads.stateOf({ workspaceId: WS, runId })
    const question: unknown = view?.status === "stopped" ? view.stop?.question : null
    return typeof question === "object" && question !== null ? { ...question } : null
}

describe("a customer send whose outcome nobody knows is never a success, and is sent again under the same key", () => {
    it("the answer's send times out: parked on a retry (no stop, nothing claims to have answered, ledger `unknown`); the channel back, the timer re-sends ONCE under the same key", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        // Each run of the answer step asks its agent turns afresh (the retry is a new visit: nothing of the failed one is replayed).
        db.model.script(ANSWER, sends(REPLY), { done: { reply: REPLY } }, sends(REPLY), { done: { reply: REPLY } }, sends(REPLY), { done: { reply: REPLY } })
        db.chat.channelOutcome = "ambiguous"
        const process = await processOf(db)

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(await stopsOf(process, runId)).toEqual([])
        const park = await parkOf(process, runId)
        expect(park).toMatchObject({ kind: "until_round", loopKey: "retry:answer", round: 1 })
        expect(db.lines).toEqual([])
        expect(db.chat.ledger.rows.map((row) => [row.text, row.state])).toEqual([[REPLY, "unknown"]])

        db.chat.channelOutcome = "acknowledged"
        db.clock.advance(2 * 60_000)
        const from = db.wakes.length
        await expect(
            process.deadlines?.fire({ workspaceId: WS, runId, stepKey: String(park?.parkKey), repeats: 1, answered: -1 }),
        ).resolves.toBe("admitted")
        await drain(process, from)

        expect(await stopsOf(process, runId)).toEqual([])
        // ONE ledger row: the same send key, claimed again and delivered.
        expect(db.chat.ledger.rows.map((row) => [row.text, row.state])).toEqual([[REPLY, "delivered"]])
    })
})
