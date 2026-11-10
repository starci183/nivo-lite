import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    CONV,
    CORE,
    UNDERSTAND,
    actsOf,
    button,
    customerWrites,
    founderDecides,
    processOf,
    refOf,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import type { ModelAnswer } from "./thread-world-outside"

// FX2 (D-P11-2, restart FIFTEEN, live): ONE customer line per stop, ever (design 8.3). The front desk's `answer` step told the customer
// it would check (its own `nivo.lead.message.send`), then reported confused; the AI core's report carried a holding line too, and the
// engine sent it as a SECOND line (`honest-line:<run>:answer`). Now the engine reads the stop it just opened (its `customerLines`, filled
// from the effect ledger's sends of this run + step) and adds no line when the step already told the customer for this stop.

const QUESTION = "Shop co xuat hoa don VAT cho cong ty khong a?"
const STEP_LINE = "Da ve hoa don VAT em chua co thong tin chac chan, em hoi lai chu tiem roi bao minh som a."
const ENGINE_LINE = "Da em da ghi nhan cau hoi ve hoa don VAT, em dang xac nhan lai voi chu tiem a."

const send = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })
const confused = { confused: { reason: "Tai lieu cua shop khong noi ve hoa don VAT", question: "Shop co xuat hoa don VAT khong?" } }
const report = (customerLine: string | null) => ({
    decision: "report",
    reason: "Buoc tra loi khong co thong tin ve hoa don VAT.",
    question: "Shop co xuat hoa don VAT cho cong ty khong?",
    suggestions: [
        { text: "Co, gui ten cong ty va ma so thue", handledBy: "workflow" },
        { text: "Toi tu tra loi", handledBy: "person" },
    ],
    customerLine,
})

/** The texts the channel delivered to the customer, in order. */
const linesOf = (db: ThreadDb): ReadonlyArray<string> => db.lines.map((line) => line.text)

/** The front desk understands a question its knowledge does not cover; the answer step does as scripted; the AI core reports. */
const askedVat = async (db: ThreadDb, answerTurns: ReadonlyArray<ModelAnswer>, options: { readonly agentLoop?: ReadonlyArray<string> } = {}) => {
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: hoa don VAT" } })
    db.model.script(ANSWER, ...answerTurns)
    db.model.script(CORE, report(ENGINE_LINE))
    const process = await processOf(db, options.agentLoop === undefined ? {} : { agentLoop: [...options.agentLoop] })
    const woken = await customerWrites(process, QUESTION)
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("stopped")
    return { process, runId }
}

describe("one customer line per stop (D-P11-2)", () => {
    it("LIVE: the step sends its own holding line, then is confused: ONE line (the step's), one stop, one card, the stop holds that line", async () => {
        const db = threadDbOf({ uuidRuns: true })
        const { process, runId } = await askedVat(db, [send(STEP_LINE), confused])

        // The AI core was asked and chose a holding line; the engine did not send it: the step already told the customer.
        expect(db.model.askedOf(CORE)).toHaveLength(1)
        expect(actsOf(db, TOOL.customerMessageSend).map((act) => act.payload.text)).toEqual([STEP_LINE])
        expect(actsOf(db, TOOL.customerMessageSend).map((act) => act.key)).not.toContain(`honest-line:${runId}:answer`)
        expect(linesOf(db)).toEqual([STEP_LINE])
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["answer", "ai_report", "open"]])
        expect(stops[0]?.customerLines.map((line) => [line.conversationId, line.text])).toEqual([[CONV, STEP_LINE]])
        expect(actsOf(db, TOOL.teamMessagePost)).toHaveLength(1)
        expect(db.team).toHaveLength(1)
    })

    it("mirror: the step sent nothing: the engine's holding line is the one line, kept on the stop", async () => {
        const db = threadDbOf({ uuidRuns: true })
        const { process, runId } = await askedVat(db, [confused])

        expect(actsOf(db, TOOL.customerMessageSend).map((act) => [act.key, act.payload.text])).toEqual([
            [`honest-line:${runId}:answer`, ENGINE_LINE],
        ])
        expect(linesOf(db)).toEqual([ENGINE_LINE])
        const stops = await stopsOf(process, runId)
        expect(stops).toHaveLength(1)
        expect(stops[0]?.customerLines.map((line) => [line.conversationId, line.text])).toEqual([[CONV, ENGINE_LINE]])
        expect(db.team).toHaveLength(1)
    })

    it("retry after the LIVE stop: the reworded line is refused by the door, the step stops again, the engine adds none; still ONE line", async () => {
        const db = threadDbOf({ uuidRuns: true })
        const { process, runId } = await askedVat(db, [send(STEP_LINE), confused])
        db.model.script(ANSWER, send("Da shop van dang kiem tra hoa don VAT nhe."), confused)
        db.model.script(CORE, report(ENGINE_LINE))

        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request)).toContain("already_told_for_this_stop")
        expect(db.model.askedOf(CORE)).toHaveLength(2)
        expect(linesOf(db)).toEqual([STEP_LINE])
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.state, stop.repeats])).toEqual([["answer", "open", 2]])
        expect(stops[0]?.customerLines.map((line) => line.text)).toEqual([STEP_LINE])
        expect(db.team).toHaveLength(1)
    })

    it("a rights refusal after the step's line (an effect the step does not declare): the AI core reports, the engine adds no line", async () => {
        const db = threadDbOf({ uuidRuns: true })
        const { process, runId } = await askedVat(db, [
            send(STEP_LINE),
            { call: { tool: TOOL.paymentQrCreate, args: { orderId: "order-1" } } },
            confused,
        ])

        expect(actsOf(db, TOOL.paymentQrCreate)).toEqual([])
        expect(db.model.askedOf(CORE)).toHaveLength(1)
        expect(linesOf(db)).toEqual([STEP_LINE])
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind])).toEqual([["answer", "ai_report"]])
        expect(stops[0]?.customerLines.map((line) => line.text)).toEqual([STEP_LINE])
    })

    it("the AI fails after the step's line (3 tries of a turn, prebuilt loop): one ai_error stop, no engine line, the stop holds the step's", async () => {
        const db = threadDbOf({ uuidRuns: true })
        const timeout = (): Error => Object.assign(new Error("deadline"), { name: "TimeoutError" })
        const { process, runId } = await askedVat(db, [send(STEP_LINE), timeout(), timeout(), timeout()], {
            agentLoop: ["chatbot.answer"],
        })

        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect(linesOf(db)).toEqual([STEP_LINE])
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["answer", "ai_error", "open"]])
        expect(stops[0]?.customerLines.map((line) => line.text)).toEqual([STEP_LINE])
        expect(db.team).toHaveLength(1)
    })
})
