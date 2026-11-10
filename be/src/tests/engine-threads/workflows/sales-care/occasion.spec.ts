import { TOOL } from "@nivo-lite/blocks-core"
import { LEAD, actsOf, answer, founderDecides, redrive, rowsOf, stopsOf } from "../../thread-world"
import {
    W8P,
    careTimerWake,
    confusedAnswer,
    coreReport,
    diesAtDone,
    threadStatusOf,
    threadStepsOf,
    w8OutcomeOf,
    w8ProcessOf,
    w8Wake,
} from "../../thread-world-w8-wakes"
import { calls, linesOf, moneyDbOf, type MoneyDb } from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"
import baseline from "./occasion.baseline.json"

// Package W8 (design row 2-2): `sales.occasion` (suggest → greeted) on a LangGraph thread, woken by an occasion timer. Twin walk (the
// suggestion goes out and next year is armed by code) against the old engine (fixed baseline: the old engine's walk, which this twin held equal to the thread at tree aa40f9655; old half removed in phase 3, package X1),
// one stop, one kill after the suggestion was sent.

const PAID = {
    id: "order-1",
    orderNo: "DH-1",
    leadId: LEAD,
    items: { lines: [{ name: "Gio hoa nho", qty: 2, unitVnd: 2000, amountVnd: 4000 }] },
    amountVnd: 4000,
    status: "paid",
    shippedAt: "2026-10-01T02:00:00.000Z",
    confirmedAt: "2026-09-30T09:00:00.000Z",
}
const books = () => ({ order: [{ ...PAID }] })

/** Her mother's birthday on 14 November: inside the seven-day lead time on the world's clock (2026-11-10). */
const SUFFIX = "sinhnhatme-11-14"
const occasionLead = (db: MoneyDb) => {
    db.store["sales-lead"] = [{ id: LEAD, contactName: "Lan" }]
    db.store["agent-lead-memory"] = [
        {
            id: "memory-1",
            entryKey: `lead:${LEAD}|$lead|$facts`,
            output: { value: { recipientName: "me", occasions: [{ label: "sinh nhat me", date: "11-14" }] } },
        },
    ]
}
const DUE_AT = "2026-11-06T17:00:00.000Z"
/** Next year's moment, armed by the step's code after the suggestion: seven days before 14 November 2027 (Vietnam midnight). */
const NEXT_YEAR = { kind: "occasion", ref: LEAD, dueAt: "2027-11-06T17:00:00.000Z", suffix: SUFFIX }
const SUGGESTION = "Chi Lan oi, sap toi sinh nhat me chi roi, chi co muon dat gio hoa nho nhu lan truoc khong a?"
const PATH = ["suggest", "greeted"]

const suggests = (db: MoneyDb) => {
    occasionLead(db)
    db.model.script(W8P.occasion, calls(TOOL.customerMessageSend, { leadId: LEAD, text: SUGGESTION }), {
        done: { leadId: LEAD, result: "sent" },
    })
}

const started = async (script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf(books(), script)
    const woken = await w8Wake(process, careTimerWake("occasion", LEAD, DUE_AT, SUFFIX))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

describe("occasion on a thread against the old engine's baseline", () => {
    it("the suggestion goes out once and next year is armed: the old engine's steps, acts, line, ledger and model calls", async () => {
        const old = baseline
        const thread = await started(suggests)

        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(PATH)
        expect(w8OutcomeOf(thread.db)).toEqual(old.outcome)
        expect(linesOf(thread.db)).toEqual([SUGGESTION])
        expect(actsOf(thread.db, TOOL.careSchedule).map((act) => act.payload)).toEqual([NEXT_YEAR])
        // A thread adds no model call: 2 on the old engine.
        expect(thread.db.model.asked.length).toBe(old.asked)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("occasion on a thread: the stop", () => {
    it("the agent cannot tell what to suggest: a stop, one card, no line, nothing armed; the founder's words resume it", async () => {
        const Q = "Lan truoc khach phan nan hoa heo, van goi y dat lai khong?"
        const { process, db, runId } = await started((one) => {
            occasionLead(one)
            one.model.script(W8P.occasion, confusedAnswer("Don truoc co phan nan", Q))
            one.model.script(W8P.core, coreReport(Q))
        })

        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["suggest", "ai_report", "open"],
        ])
        expect(linesOf(db)).toEqual([])
        expect(actsOf(db, TOOL.careSchedule)).toEqual([])
        expect(db.team).toHaveLength(1)
        const asked = db.model.asked.length
        await redrive(process, runId, "sweep-1")
        expect(db.model.asked.length).toBe(asked)

        db.model.script(W8P.occasion, calls(TOOL.customerMessageSend, { leadId: LEAD, text: SUGGESTION }), {
            done: { leadId: LEAD, result: "sent" },
        })
        const ran = await founderDecides(process, runId, answer(db, "Van goi y, nhung nhe nhang thoi"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.occasion).at(-1)?.request)).toContain("nhung nhe nhang thoi")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(linesOf(db)).toEqual([SUGGESTION])
        expect(actsOf(db, TOOL.careSchedule).map((act) => act.payload)).toEqual([NEXT_YEAR])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "answer" } })
        expect(db.team).toHaveLength(1)
    })
})

describe("occasion on a thread: killed and replayed", () => {
    it("killed after the suggestion was sent and next year armed: one line, one timer, no effect twice", async () => {
        const db = moneyDbOf(books())
        suggests(db)
        diesAtDone(db, 1)
        const first = await moneyProcessOf(db)
        const woken = await w8Wake(first, careTimerWake("occasion", LEAD, DUE_AT, SUFFIX))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(linesOf(db)).toEqual([SUGGESTION])

        suggests(db)
        const second = await moneyProcessOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([SUGGESTION])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(actsOf(db, TOOL.careSchedule)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})
