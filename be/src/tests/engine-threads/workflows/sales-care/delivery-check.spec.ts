import { TOOL } from "@nivo-lite/blocks-core"
import { LEAD, actsOf, answer, button, founderDecides, playOld, redrive, rowsOf, stopsOf } from "../../thread-world"
import {
    W8P,
    W8_WORKFLOWS,
    careTimerWake,
    confusedAnswer,
    coreReport,
    diesAtDone,
    threadStatusOf,
    threadStepsOf,
    turnPolicyOf,
    w8OutcomeOf,
    w8ProcessOf,
    w8Wake,
} from "../../thread-world-w8-wakes"
import { calls, linesOf, moneyDbOf, type MoneyDb } from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"

// Package W8 (design row 2-2): `sales.delivery-check` (check → checked) on a LangGraph thread, woken by its care timer. Twin walk with
// the old engine (the question goes out; a timer that woke early only moves), one stop, one kill after the question was sent.

const ORDER = "order-1"
const PAID = {
    id: ORDER,
    orderNo: "DH-1",
    leadId: LEAD,
    items: { lines: [{ name: "Gio hoa nho", qty: 2, unitVnd: 2000, amountVnd: 4000 }] },
    amountVnd: 4000,
    status: "paid",
    shippedAt: null,
    confirmedAt: "2026-11-10T09:00:00.000Z",
}
const books = () => ({ order: [{ ...PAID }] })

/** Due: the morning after delivery, already past on the world's clock (2026-11-10 10:00 UTC on). */
const DUE = "2026-11-10T02:00:00.000Z"
/** Early: a timer that woke before its real moment. */
const EARLY = "2026-11-20T02:00:00.000Z"
const QUESTION = "Chi Lan oi, 2 gio hoa nho da toi noi chu? Chi co hai long khong a?"
const PATH = ["check", "checked"]

const asks = (db: MoneyDb) =>
    db.model.script(W8P.deliveryCheck, calls(TOOL.customerMessageSend, { leadId: LEAD, text: QUESTION }), {
        done: { orderId: ORDER, result: "asked" },
    })

const STOP_Q = "Khach dang nhan tin phan nan ve don DH-1, van hoi tham hay de chu tiem lien he?"
const asksThenStops = (db: MoneyDb, text = QUESTION) => {
    db.model.script(
        W8P.deliveryCheck,
        calls(TOOL.customerMessageSend, { leadId: LEAD, text }),
        confusedAnswer("Khach dang phan nan", STOP_Q),
    )
    db.model.script(W8P.core, coreReport(STOP_Q))
}

const started = async (flag: ReadonlyArray<string>, dueAt: string, script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf(books(), flag, script)
    const woken = await w8Wake(process, careTimerWake("delivery-check", ORDER, dueAt))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

describe("delivery-check on a thread: twin walk with the old engine", () => {
    it("due: the question goes out once; same steps, acts, line, ledger and model calls on both engines", async () => {
        const old = await started([], DUE, asks)
        const played = await playOld(old.process, old.runId)
        const thread = await started([W8_WORKFLOWS.deliveryCheck], DUE, asks)

        expect(played.path).toEqual(PATH)
        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(played.path)
        expect(w8OutcomeOf(thread.db)).toEqual(w8OutcomeOf(old.db))
        expect(linesOf(thread.db)).toEqual([QUESTION])
        expect(thread.db.acts.map((act) => act.effect)).toEqual([TOOL.customerMessageSend])
        expect(thread.db.model.asked.length).toBe(old.db.model.asked.length)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })

    it("early: the timer is moved to its real moment, nothing asked, no model call, on both engines alike", async () => {
        const old = await started([], EARLY, () => undefined)
        const played = await playOld(old.process, old.runId)
        const thread = await started([W8_WORKFLOWS.deliveryCheck], EARLY, () => undefined)

        expect(played.path).toEqual(PATH)
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(PATH)
        expect(w8OutcomeOf(thread.db)).toEqual(w8OutcomeOf(old.db))
        expect(actsOf(thread.db, TOOL.careSchedule).map((act) => act.payload)).toEqual([
            { kind: "delivery-check", ref: ORDER, dueAt: EARLY },
        ])
        expect(linesOf(thread.db)).toEqual([])
        expect(thread.db.model.asked).toEqual([])
    })
})

describe("delivery-check on a thread: the stop", () => {
    it("one line, one stop record, one card; re-drives move nothing; a retry makes no second line; skip undoes nothing", async () => {
        const { process, db, runId } = await started([W8_WORKFLOWS.deliveryCheck], DUE, (one) => asksThenStops(one))

        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([QUESTION])
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ stepKey: "check", kind: "ai_report", state: "open" })
        expect(stop?.customerLines.map((line) => [line.conversationId, line.text])).toEqual([["conv-1", QUESTION]])
        expect(db.team).toHaveLength(1)
        const asked = db.model.asked.length

        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        expect(db.model.asked.length).toBe(asked)
        expect(linesOf(db)).toEqual([QUESTION])

        // A retry with no words: the step runs again, the door refuses a second line for the same stop, it stops again (folded).
        asksThenStops(db, "Chi Lan oi, hoa toi chua a?")
        await founderDecides(process, runId, button(db, "retry"))
        expect(linesOf(db)).toEqual([QUESTION])
        expect(JSON.stringify(db.model.askedOf(W8P.deliveryCheck).at(-1)?.request)).toContain("already_told_for_this_stop")
        expect((await stopsOf(process, runId)).map((one) => [one.state, one.repeats])).toEqual([["open", 2]])

        // Skip: the run ends, the line stays as it was; nothing is undone, nothing sent.
        await founderDecides(process, runId, button(db, "skip"))
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        expect(linesOf(db)).toEqual([QUESTION])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect(db.team).toHaveLength(1)
    })

    it("confused before asking (a complaint is open): a stop with no line; the founder's words resume it; it asks once and ends", async () => {
        const Q = "Khach dang phan nan don DH-1, van hoi tham khong?"
        const { process, db, runId } = await started([W8_WORKFLOWS.deliveryCheck], DUE, (one) => {
            one.model.script(W8P.deliveryCheck, confusedAnswer("Khach dang phan nan", Q))
            one.model.script(W8P.core, coreReport(Q))
        })
        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([])

        asks(db)
        const ran = await founderDecides(process, runId, answer(db, "Phan nan xong roi, cu hoi tham nhe nhang"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.deliveryCheck).at(-1)?.request)).toContain("cu hoi tham nhe nhang")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([QUESTION])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "answer" } })
        expect(db.team).toHaveLength(1)
        expect(JSON.stringify(db.team[0]?.versions.at(-1))).toContain("cu hoi tham nhe nhang")
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })

    it("D-W8-1 end to end: told before its stop, the founder answers \"đã hỏi rồi, làm tiếp\": the step ends, no second line, no ai_error", async () => {
        // The real turn policy (W3's fill): after the answer it tells the step what THIS run + step already did (`alreadyDone`).
        const db = moneyDbOf(books())
        asksThenStops(db)
        const process = await moneyProcessOf(db, [W8_WORKFLOWS.deliveryCheck], [turnPolicyOf(db)])
        const woken = await w8Wake(process, careTimerWake("delivery-check", ORDER, DUE))
        const runId = woken.runId ?? ""
        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([QUESTION])

        db.model.script(W8P.deliveryCheck, { done: { orderId: ORDER, result: "asked" } })
        const ran = await founderDecides(process, runId, answer(db, "đã hỏi rồi, làm tiếp"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.deliveryCheck).at(-1)?.request)).toContain("đã hỏi rồi, làm tiếp")
        expect(JSON.stringify(db.model.askedOf(W8P.deliveryCheck).at(-1)?.request)).not.toContain("REQUIRED_CALL_MISSING")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([QUESTION])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.kind, stop.state, stop.repeats])).toEqual([["ai_report", "resolved", 1]])
        expect(stops[0]?.decision).toMatchObject({ kind: "answer" })
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect(db.team).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("delivery-check on a thread: killed and replayed", () => {
    it("killed after the question was sent (check acted, its checkpoint not written): one line, no effect twice", async () => {
        const db = moneyDbOf(books())
        asks(db)
        diesAtDone(db, 1)
        const first = await moneyProcessOf(db, [W8_WORKFLOWS.deliveryCheck])
        const woken = await w8Wake(first, careTimerWake("delivery-check", ORDER, DUE))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(linesOf(db)).toEqual([QUESTION])

        asks(db)
        const second = await moneyProcessOf(db, [W8_WORKFLOWS.deliveryCheck])
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([QUESTION])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})
