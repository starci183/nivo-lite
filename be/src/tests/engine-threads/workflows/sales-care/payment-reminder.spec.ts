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
    w8OutcomeOf,
    w8ProcessOf,
    w8Wake,
    type CareKind,
} from "../../thread-world-w8-wakes"
import { calls, linesOf, moneyDbOf, type MoneyDb } from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"

// Package W8 (design row 2-2): `sales.payment-reminder` on a LangGraph thread (which → remind → reminded, or which → tell-team →
// timed-out), woken by the two payment timers the QR armed. Twin walk of both branches, one stop at the reminder, one kill after the
// reminder was sent; the side step `tell-team` (blocking: false) is passed over, never a stop.

const ORDER = "order-1"
const OPEN = {
    id: ORDER,
    orderNo: "DH-1",
    leadId: LEAD,
    items: { lines: [{ name: "Gio hoa nho", qty: 2, unitVnd: 2000, amountVnd: 4000 }] },
    amountVnd: 4000,
    status: "confirmed",
    shippedAt: null,
    confirmedAt: "2026-11-10T08:00:00.000Z",
}
const books = () => ({ order: [{ ...OPEN }] })

const DUE = "2026-11-10T10:00:00.000Z"
const REMINDER = "Shop nhac nhe chi Lan: don DH-1 van dang cho thanh toan a, thong tin chuyen khoan o tin nhan phia tren."
const NOTICE = {
    kind: "message.text",
    intent: "ask",
    title: "Don DH-1 chua thanh toan",
    text: "Chi Lan chua chuyen khoan don DH-1 sau mot ngay va mot lan nhac. Giu don hay huy a?",
}
const REMIND_PATH = ["which", "remind", "reminded"]
const STALE_PATH = ["which", "tell-team", "timed-out"]

const reminds = (db: MoneyDb) =>
    db.model.script(W8P.paymentReminder, calls(TOOL.customerMessageSend, { leadId: LEAD, text: REMINDER }), {
        done: { orderId: ORDER, result: "reminded" },
    })
const tellsTeam = (db: MoneyDb) =>
    db.model.script(W8P.unpaidNotice, calls(TOOL.teamMessagePost, NOTICE), { done: { orderId: ORDER, result: "told" } })

const started = async (flag: ReadonlyArray<string>, kind: CareKind, script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf(books(), flag, script)
    const woken = await w8Wake(process, careTimerWake(kind, ORDER, DUE))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

describe("payment-reminder on a thread: twin walk with the old engine", () => {
    it.each<[CareKind, ReadonlyArray<string>, (db: MoneyDb) => void]>([
        ["payment-reminder", REMIND_PATH, reminds],
        ["payment-stale", STALE_PATH, tellsTeam],
    ])("%s: same steps, acts, lines, cards, ledger and model calls on both engines", async (kind, path, script) => {
        const old = await started([], kind, script)
        const played = await playOld(old.process, old.runId)
        const thread = await started([W8_WORKFLOWS.paymentReminder], kind, script)

        expect(played.path).toEqual(path)
        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(played.path)
        expect(w8OutcomeOf(thread.db)).toEqual(w8OutcomeOf(old.db))
        expect(thread.db.model.asked.length).toBe(old.db.model.asked.length)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
        if (kind === "payment-reminder") {
            expect(linesOf(thread.db)).toEqual([REMINDER])
            expect(thread.db.team).toEqual([])
        } else {
            expect(linesOf(thread.db)).toEqual([])
            expect(thread.db.team.map((message) => message.versions)).toEqual([[NOTICE]])
        }
    })

    it("an order paid in the meantime: nothing to remind, no model call, on both engines alike", async () => {
        const paid = (db: MoneyDb) => {
            db.store.order = [{ ...OPEN, status: "paid" }]
        }
        const old = await started([], "payment-reminder", paid)
        const played = await playOld(old.process, old.runId)
        const thread = await started([W8_WORKFLOWS.paymentReminder], "payment-reminder", paid)

        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(played.path)
        expect(w8OutcomeOf(thread.db)).toEqual(w8OutcomeOf(old.db))
        expect(thread.db.acts).toEqual([])
        expect(thread.db.model.asked).toEqual([])
    })
})

describe("payment-reminder on a thread: the stop", () => {
    const Q = "Khach vua nhan se chuyen sau, van nhac hay doi?"
    const remindsThenStops = (db: MoneyDb, text: string) => {
        db.model.script(
            W8P.paymentReminder,
            calls(TOOL.customerMessageSend, { leadId: LEAD, text }),
            confusedAnswer("Khach hen chuyen sau", Q),
        )
        db.model.script(W8P.core, coreReport(Q))
    }

    it("one line, one record, one card; a retry with no words makes no second line; skip undoes nothing", async () => {
        const { process, db, runId } = await started([W8_WORKFLOWS.paymentReminder], "payment-reminder", (one) =>
            remindsThenStops(one, REMINDER),
        )
        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([REMINDER])
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["remind", "ai_report", "open"],
        ])

        remindsThenStops(db, "Shop nhac lai lan nua a!")
        await founderDecides(process, runId, button(db, "retry"))
        expect(linesOf(db)).toEqual([REMINDER])
        expect((await stopsOf(process, runId)).map((stop) => [stop.state, stop.repeats])).toEqual([["open", 2]])

        await founderDecides(process, runId, button(db, "skip"))
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        expect(linesOf(db)).toEqual([REMINDER])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect(db.team).toHaveLength(1)
        // No automatic compensation, and no cancel of the order by anyone but a person.
        expect(db.store.order?.[0]).toMatchObject({ status: "confirmed" })
        expect(db.acts.filter((act) => act.effect === TOOL.orderVoid || act.effect === "order.cancel")).toEqual([])
    })

    it("confused before reminding: a stop with no line; the founder's free-text answer resumes it; one reminder, run done", async () => {
        const { process, db, runId } = await started([W8_WORKFLOWS.paymentReminder], "payment-reminder", (one) => {
            one.model.script(W8P.paymentReminder, confusedAnswer("Khach hen chuyen sau", Q))
            one.model.script(W8P.core, coreReport(Q))
        })
        expect(await threadStatusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([])

        reminds(db)
        const ran = await founderDecides(process, runId, answer(db, "Van nhac nhe mot lan"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.paymentReminder).at(-1)?.request)).toContain("Van nhac nhe mot lan")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(REMIND_PATH)
        expect(linesOf(db)).toEqual([REMINDER])
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "answer" } })
        expect(db.team).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })

    it("the side step tell-team that fails is passed over: no stop, one notice to the founder, the run ends", async () => {
        const { process, db, runId } = await started([W8_WORKFLOWS.paymentReminder], "payment-stale", (one) =>
            one.model.script(W8P.unpaidNotice, confusedAnswer("Khong ro", "?")),
        )

        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(STALE_PATH)
        expect(await stopsOf(process, runId)).toEqual([])
        expect(db.team.map((message) => message.key)).toEqual([`side-passed:${runId}:tell-team`])
        expect(linesOf(db)).toEqual([])
        expect(db.model.askedOf(W8P.core)).toEqual([])
    })
})

describe("payment-reminder on a thread: killed and replayed", () => {
    it("killed after the reminder was sent (remind acted, its checkpoint not written): one line, no effect twice", async () => {
        const db = moneyDbOf(books())
        reminds(db)
        diesAtDone(db, 2)
        const first = await moneyProcessOf(db, [W8_WORKFLOWS.paymentReminder])
        const woken = await w8Wake(first, careTimerWake("payment-reminder", ORDER, DUE))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(linesOf(db)).toEqual([REMINDER])

        reminds(db)
        const second = await moneyProcessOf(db, [W8_WORKFLOWS.paymentReminder])
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(REMIND_PATH)
        expect(linesOf(db)).toEqual([REMINDER])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})
