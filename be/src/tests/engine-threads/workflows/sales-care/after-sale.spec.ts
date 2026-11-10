import { TOOL } from "@nivo-lite/blocks-core"
import { LEAD, actsOf, answer, button, founderDecides, redrive, rowsOf, stopsOf } from "../../thread-world"
import {
    W8P,
    afterSaleWake,
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
import baseline from "./after-sale.baseline.json"

// Package W8 (design row 2-2): `sales.after-sale` (thank → plan → thanked) on a LangGraph thread, woken by the reconcile's end hand-off.
// Twin walk against the old engine (fixed baseline: the old engine's walk, which this twin held equal to the thread at tree aa40f9655; old half removed in phase 3, package X1);
// the stop of the live walk on restart THIRTEEN (the thank step judged confused because the order carried
// a complaint: on threads a stop with one card and NO customer line); a kill after the thank-you was sent.

const ORDER = "order-1"
const PAID = {
    id: ORDER,
    orderNo: "DH-1",
    leadId: LEAD,
    items: [],
    amountVnd: 4000,
    status: "paid",
    shippedAt: null,
    confirmedAt: "2026-11-10T09:00:00.000Z",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAddress: "25 Nguyen Hue",
    deliveryAt: "thu Bay 9-11h",
    note: "",
}
const books = () => ({ order: [{ ...PAID }] })

const THANKS = "Shop da nhan thanh toan don DH-1, cam on chi Lan! Shop giao toi 25 Nguyen Hue thu Bay 9-11h nhe."
const STAGE = { leadId: LEAD, consultStage: "after_sale" }
const PATH = ["thank", "plan", "thanked"]
/** The check-in the morning after the delivery day the model read (2026-11-14 → 2026-11-15 09:00 Vietnam). */
const CHECK = { kind: "delivery-check", ref: ORDER, dueAt: "2026-11-15T02:00:00.000Z" }

/** The thank-you as the step's agent writes it, then the care plan's reading of the delivery day. */
const thanks = (db: MoneyDb) => {
    db.model.script(
        W8P.afterSale,
        calls(TOOL.customerMessageSend, { leadId: LEAD, text: THANKS }),
        calls(TOOL.leadUpdate, STAGE),
        { done: { orderId: ORDER, sent: true } },
    )
    db.model.script(W8P.carePlanDay, { answer: { deliverOn: "2026-11-14" } })
}

/** The live-walk case: the order carries a complaint, the thank step's agent cannot thank as told and asks the founder. */
const COMPLAINT_Q = "Don DH-1 dang co khieu nai (hoa giao tre), van gui loi cam on hay cho chu tiem xu ly?"
const complaint = (db: MoneyDb) => {
    db.model.script(W8P.afterSale, confusedAnswer("Don co khieu nai chua xu ly", COMPLAINT_Q))
    db.model.script(W8P.core, coreReport(COMPLAINT_Q))
}

const started = async (script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf(books(), script)
    const woken = await w8Wake(process, afterSaleWake(ORDER))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

describe("after-sale on a thread against the old engine's baseline", () => {
    it("thank → plan → thanked: the old engine's steps, acts, customer line, cards, ledger and model calls", async () => {
        const old = baseline
        const thread = await started(thanks)

        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(PATH)
        expect(w8OutcomeOf(thread.db)).toEqual(old.outcome)
        expect(thread.db.acts.map((act) => act.effect)).toEqual([
            TOOL.customerMessageSend,
            TOOL.leadUpdate,
            TOOL.careSchedule,
        ])
        expect(actsOf(thread.db, TOOL.careSchedule)[0]?.payload).toEqual(CHECK)
        expect(linesOf(thread.db)).toEqual([THANKS])
        expect(thread.db.lines[0]?.conversationId).toBe("conv-1")
        expect(thread.db.team).toEqual([])
        // A thread adds no model call: 4 on the old engine.
        expect(thread.db.model.asked.length).toBe(old.asked)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
        expect(await stopsOf(thread.process, thread.runId)).toEqual([])
    })
})

describe("after-sale on a thread: the stop (live walk, restart THIRTEEN: an order with a complaint)", () => {
    it("the thank step judged confused: a stop with ONE card and NO customer line; nothing sent, no stage, no care armed", async () => {
        const { process, db, runId } = await started(complaint)

        expect(await threadStatusOf(process, runId)).toBe("stopped")
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["thank", "ai_report", "open"]])
        expect(stops[0]?.customerLines).toEqual([])
        expect(linesOf(db)).toEqual([])
        expect(db.team).toHaveLength(1)
        expect(db.team[0]?.key).toBe(`run-stuck:${runId}:thank`)
        expect(stops[0]?.cardMessageId).toBe(db.team[0]?.id)
        expect(actsOf(db, TOOL.customerMessageSend)).toEqual([])
        expect(actsOf(db, TOOL.leadUpdate)).toEqual([])
        expect(actsOf(db, TOOL.careSchedule)).toEqual([])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "waiting" })
    })

    it("a confused stop is never auto-resumed: three re-drives ask no model, send nothing, keep one card", async () => {
        const { process, db, runId } = await started(complaint)
        const asked = db.model.asked.length

        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        await redrive(process, runId, "sweep-3")

        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(db.model.asked.length).toBe(asked)
        expect(linesOf(db)).toEqual([])
        expect(db.team).toHaveLength(1)
        expect((await stopsOf(process, runId)).map((stop) => stop.repeats)).toEqual([1])
    })

    it("the founder's free-text answer resumes the step: it sees the words, thanks once, plans; one record, one card rewritten", async () => {
        const { process, db, runId } = await started(complaint)
        thanks(db)

        const ran = await founderDecides(process, runId, answer(db, "Khieu nai da xu ly xong, cu cam on khach binh thuong"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.afterSale).at(-1)?.request)).toContain("cu cam on khach binh thuong")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([THANKS])
        expect(actsOf(db, TOOL.leadUpdate)).toHaveLength(1)
        expect(actsOf(db, TOOL.careSchedule)).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ stepKey: "thank", state: "resolved", decision: { kind: "answer" } })
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect(db.team).toHaveLength(1)
        expect(db.team[0]?.versions.length).toBeGreaterThan(1)
        expect(JSON.stringify(db.team[0]?.versions.at(-1))).toContain("cu cam on khach binh thuong")
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })

    it("one record per run + step: stopped again after an answer, it folds into the same stop and the same card", async () => {
        const { process, db, runId } = await started(complaint)
        complaint(db)

        await founderDecides(process, runId, answer(db, "Doi toi hoi lai khach da"))

        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ stepKey: "thank", state: "open", repeats: 2 })
        expect(stop?.answers.map((one) => one.text)).toEqual(["Doi toi hoi lai khach da"])
        expect(db.team).toHaveLength(1)
        expect(linesOf(db)).toEqual([])
    })

    it("a stop after the step told the customer: one line; a retry with no words cannot make a second; skip undoes nothing", async () => {
        const told = (db: MoneyDb, text: string) => {
            db.model.script(
                W8P.afterSale,
                calls(TOOL.customerMessageSend, { leadId: LEAD, text }),
                calls(TOOL.leadUpdate, STAGE),
                confusedAnswer("Khach hoi doi dia chi", "Khach muon doi dia chi giao, doi theo khach?"),
            )
            db.model.script(W8P.core, coreReport("Khach muon doi dia chi giao, doi theo khach?"))
        }
        const { process, db, runId } = await started((one) => told(one, THANKS))
        expect(linesOf(db)).toEqual([THANKS])
        const [first] = await stopsOf(process, runId)
        expect(first?.customerLines.map((line) => [line.conversationId, line.text])).toEqual([["conv-1", THANKS]])

        told(db, "Shop cam on chi lan nua a!")
        await founderDecides(process, runId, button(db, "retry"))

        expect(linesOf(db)).toEqual([THANKS])
        expect(JSON.stringify(db.model.askedOf(W8P.afterSale).at(-1)?.request)).toContain("already_told_for_this_stop")
        expect((await stopsOf(process, runId)).map((stop) => [stop.state, stop.repeats])).toEqual([["open", 2]])
        expect(db.team).toHaveLength(1)

        await founderDecides(process, runId, button(db, "skip"))

        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        // No automatic compensation: the line, the stage stay; nothing armed, nothing reversed.
        expect(linesOf(db)).toEqual([THANKS])
        expect(actsOf(db, TOOL.leadUpdate).map((act) => act.payload)).toEqual([STAGE])
        expect(actsOf(db, TOOL.careSchedule)).toEqual([])
        // Every other act is the one stop card, posted under its key and rewritten in place (open → folded → resolved).
        expect(db.acts.filter((act) => act.effect !== TOOL.teamMessagePost).map((act) => act.effect)).toEqual([
            TOOL.customerMessageSend,
            TOOL.leadUpdate,
        ])
        expect(new Set(actsOf(db, TOOL.teamMessagePost).map((act) => act.dedupeKey ?? act.key))).toEqual(
            new Set([`run-stuck:${runId}:thank`]),
        )
        expect(db.team).toHaveLength(1)
    })
})

describe("after-sale on a thread: killed and replayed", () => {
    it.each<[string, number]>([
        ["after the thank-you was sent (thank acted, its checkpoint not written)", 1],
        ["after the care was armed (plan acted, its checkpoint not written)", 2],
    ])("killed %s: a new process goes on; no effect twice, no line twice", async (_name, nth) => {
        const db = moneyDbOf(books())
        thanks(db)
        diesAtDone(db, nth)
        const first = await moneyProcessOf(db)
        const woken = await w8Wake(first, afterSaleWake(ORDER))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(await threadStatusOf(first, runId)).toBe("open")
        expect(linesOf(db)).toEqual([THANKS])

        // The unfinished step may ask its model again on the re-drive; script it once more, the ledger answers its effects.
        thanks(db)
        const second = await moneyProcessOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(PATH)
        expect(linesOf(db)).toEqual([THANKS])
        expect(db.acts.map((act) => act.effect)).toEqual([
            TOOL.customerMessageSend,
            TOOL.leadUpdate,
            TOOL.careSchedule,
        ])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
        expect(await stopsOf(second, runId)).toEqual([])
    })
})
