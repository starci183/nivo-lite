import { TOOL } from "@nivo-lite/agent-sdk/names"
import { holdProvidersOf } from "./thread-world-core"
import { ANSWER, CORE, FRONT, UNDERSTAND, button, customerWrites, drain, founderDecides, processOf, rowsOf, stopsOf, threadDbOf } from "./thread-world"

// A founder's `take_over` on a stop of a front-desk run (decoupling plan row 3). Nothing of the chatbot's records is involved: the run waits
// as taken over with its stop open, so the engine's HOLD of the customer keeps the next line out of any new run (it joins the stopped run),
// the AI says nothing, the engine writes no chat record, and no plugin service is asked (the world composes none: a call would throw or be
// seen in `chat.calls`). A later `skip` ends the run.

const QUESTION = "Shop mo cua may gio?"
const AGAIN = "Co ai o do khong?"

describe("a stop taken over by the founder (take_over)", () => {
    it("the customer's next line gets no AI reply and starts no run; a later skip ends the run", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, { confused: { reason: "Khong ro gio mo cua", question: "Shop mo may gio?" } })
        db.model.script(CORE, {
            decision: "report",
            reason: "x",
            question: "Shop mo may gio?",
            suggestions: [{ text: "8h-21h", handledBy: "workflow" }],
            customerLine: null,
        })
        const process = await processOf(db, { extra: holdProvidersOf(db) })
        const asked = await customerWrites(process, QUESTION)
        const runId = asked.runId ?? ""
        expect((await stopsOf(process, runId)).map((stop) => stop.state)).toEqual(["open"])

        await founderDecides(process, runId, button(db, "take_over"))
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", error: { code: "taken_over" } })

        // The customer writes again.
        const modelCalls = db.model.asked.length
        const chatWrites = db.chat.calls.length
        const lines = db.lines.length
        const messages = db.chat.messages.size
        const next = await customerWrites(process, AGAIN)

        // No run, no reply, no model call: the line is held (it joins the stopped run).
        expect(next.error).toBeNull()
        expect(next.ending).toMatchObject({ status: "held" })
        expect([...db.runs.keys()]).toEqual([runId])
        expect(db.model.asked).toHaveLength(modelCalls)
        expect(db.lines).toHaveLength(lines)
        expect(db.acts.filter((act) => act.effect === TOOL.customerMessageSend)).toHaveLength(0)
        // The engine wrote no chatbot record for it, and no plugin service was asked: the record tools were not called, no line was stored.
        expect(db.chat.calls).toHaveLength(chatWrites)
        expect(db.chat.messages.size).toBe(messages)
        expect(db.chat.calls.every((call) => call.agentId === FRONT)).toBe(true)
        // The raw row of the line is kept (the engine's own record of the words: the body Zalo posted, under `raw`, as hear-stores-line reads it).
        expect(db.chat.raw.map((row) => (row.value.raw as { message: { text: string } }).message.text)).toEqual([QUESTION, AGAIN])

        // The founder skips: the stop resolves and the run ends where it is.
        const skipped = await founderDecides(process, runId, button(db, "skip"))
        expect(skipped.map((one) => one.error)).toEqual([null])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        expect((await stopsOf(process, runId)).map((stop) => stop.state)).toEqual(["resolved"])
        // Whatever the run left for the held line, drained now, tells the customer nothing by itself.
        await drain(process, db.wakes.length)
        expect(db.lines).toHaveLength(lines)
    })
})
