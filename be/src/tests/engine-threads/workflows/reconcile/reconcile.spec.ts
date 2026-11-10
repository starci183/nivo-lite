import { TOOL } from "@nivo-lite/blocks-core"
import {
    actsOf,
    answer,
    button,
    founderDecides,
    redrive,
    rowsOf,
    stopsOf,
    type ThreadProcess,
} from "../../thread-world"
import {
    ACCOUNTING,
    P,
    bankFeedWake,
    calls,
    linesOf,
    moneyDbOf,
    rematchWake,
    wake,
    type MoneyDb,
    type WakeIn,
} from "./thread-world-money"
import { moneyProcessOf } from "./thread-world-money-process"
import baseline from "./reconcile.baseline.json"

// Package P7 (design row 1-8): `accounting.reconcile` on a LangGraph thread, both triggers (the bank feed's credit and the rematch
// job's start), with the real thread engine, stops, effect ledger and door checks of the 0-9 world. The money decisions are the
// model's (scripted here): what the specs prove is what the ENGINE does with them — one settle, one ledger line per transaction, one
// stop record per run + step, one customer line per stop, a stop moved only by a person, nothing undone by itself. The old engine's
// half of the twin walk is gone (phase 3, package X1); what the twin held equal is kept as a fixed baseline (`reconcile.baseline.json`).

const ORDER = "order-1"
const OWES = 4000
const order = {
    id: ORDER,
    orderNo: "DH-1",
    leadId: "lead-1",
    items: [],
    amountVnd: OWES,
    status: "confirmed",
    confirmedAt: "2026-11-10T09:00:00.000Z",
    createdAt: "2026-11-10T08:00:00.000Z",
}
const credit = (id: string, amountVnd: number, reference: string) => ({
    id,
    amountVnd,
    reference,
    payer: "NGUYEN THI LAN",
    occurredAt: "2026-11-10T10:00:00.000Z",
    orderId: null,
    status: "unmatched",
})
const EXACT = credit("tx-exact", OWES, "DH1 chuyen tien hoa")
const WRONG_CODE = credit("tx-wrong", OWES, "DH9999 chuyen tien")
const SHORT = credit("tx-short", 1000, "DH1")
const OVER = credit("tx-over", 6000, "DH1")

/** The checking line to the order's customer (by lead: a bank-fed run has no conversation); it names no order. */
const CHECKING = "Shop da nhan khoan chuyen 4.000d cua ban, shop dang kiem tra va se bao lai ngay a."
const SHORT_LINE = "Shop da nhan 1.000d, shop dang kiem tra voi chu tiem va bao lai ban a."

const report = (question: string) => ({
    decision: "report",
    reason: "Khoan tien chua ro la cua don nao.",
    question,
    suggestions: [
        { text: "Ghi nhan cho don DH-1", handledBy: "workflow" },
        { text: "Toi tu xu ly", handledBy: "person" },
    ],
    customerLine: null,
})
const confused = (question: string) => ({ confused: { reason: "Chua ro", question } })

/** The match settles `tx` onto the order; settle, ledger and the paid card follow (each as the step's agent acts). */
const settles = (db: MoneyDb, tx: string) => {
    db.model.script(P.match, {
        done: {
            transactionId: tx,
            orderId: ORDER,
            claimId: null,
            settle: true,
            reason: "Ma DH1 va so tien khop don DH-1",
        },
    })
    db.model.script(P.settle, calls(TOOL.paymentMarkPaid, { orderId: ORDER, transactionId: tx }), {
        done: { result: "paid" },
    })
    db.model.script(P.post, calls(TOOL.ledgerAppend, { transactionId: tx }), { done: { ref: "sheet-row-1" } })
    db.model.script(P.paidNotice, calls(TOOL.teamMessagePost, { kind: "payment.received", orderId: ORDER }), {
        done: { posted: true },
    })
}

const PAID_PATH = ["match", "mark-paid", "ledger", "notify-paid", "to-after-sale"]

const ref = (runId: string) => ({ workspaceId: "11111111-1111-4111-8111-111111111111", runId })

const started = async (db: MoneyDb, start: WakeIn) => {
    const process = await moneyProcessOf(db)
    const woken = await wake(process, start)
    expect(woken.error).toBeNull()
    return { process, runId: woken.runId ?? "" }
}

const statusOf = async (process: ThreadProcess, runId: string) => (await process.threads.stateOf(ref(runId)))?.status

/** What a walk left in the world, in the form the baseline holds. */
const outcomeOf = (db: MoneyDb) => ({
    acts: db.acts.map((act) => ({ effect: act.effect, payload: act.payload, key: act.key, dedupeKey: act.dedupeKey })),
    lines: db.lines.map((line) => ({ conversationId: line.conversationId, text: line.text })),
    team: db.team.map((message) => ({ key: message.key, versions: message.versions })),
    tools: db.toolCalls,
    book: [...db.book.entries()],
    ledger: db.records.of("agent.node-effect").map((row) => row.data),
    modelAsked: db.model.asked.map((one) => one.purpose),
})

const books = () => ({
    order: [{ ...order }],
    "bank-transaction": [{ ...EXACT }, { ...WRONG_CODE }, { ...SHORT }, { ...OVER }],
})

/** The wrong code with the right amount: the match tells the order's customer one line, then asks the founder. */
const wrongCode = (db: MoneyDb) => {
    db.model.script(
        P.match,
        calls(TOOL.customerMessageSend, { leadId: "lead-1", text: CHECKING }),
        confused("Khoan 4.000d ma DH9999 co phai cua don DH-1?"),
    )
    db.model.script(P.core, report("Khoan 4.000d ma DH9999 co phai cua don DH-1?"))
    return started(db, bankFeedWake(WRONG_CODE.id))
}

describe("reconcile on a thread: an exact transfer, both triggers", () => {
    it.each<[string, WakeIn]>([
        ["bank feed", bankFeedWake(EXACT.id)],
        ["rematch job", rematchWake(EXACT.id, ORDER)],
    ])(
        "%s: the thread walks the old engine's steps with its acts, lines, cards and ledger line (fixed baseline)",
        async (name, start) => {
            const old = name === "bank feed" ? baseline["bank feed"] : baseline["rematch job"]
            const db = moneyDbOf(books())
            settles(db, EXACT.id)
            const { process, runId } = await started(db, start)

            const view = await process.threads.stateOf(ref(runId))
            expect(view?.status).toBe("ended")
            // The old engine walked PAID_PATH on both triggers.
            expect(Object.keys(view?.state.steps ?? {})).toEqual(PAID_PATH)
            expect(outcomeOf(db)).toEqual(old.outcome)
            expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
            // Exactly one settle and ONE ledger line, keyed by the transaction; the paid card once; the hand-off to the after-sale once.
            expect(actsOf(db, TOOL.paymentMarkPaid).map((act) => act.payload)).toEqual([
                { orderId: ORDER, transactionId: EXACT.id },
            ])
            expect([...db.book.keys()]).toEqual([EXACT.id])
            expect(db.team.map((message) => message.versions.at(0)?.kind)).toEqual(["payment.received"])
            expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
            expect(actsOf(db, TOOL.agentTag)[0]?.payload).toMatchObject({
                context: { params: { orderId: ORDER, leadId: "lead-1" } },
            })
            expect(linesOf(db)).toEqual([])
            expect(await stopsOf(process, runId)).toEqual([])
            // A thread adds no model call: 7 on the old engine (baseline).
            expect(db.model.asked.length).toBe(old.asked)
        },
    )
})

describe("reconcile on a thread: one ledger line per transaction, whatever wakes it or kills it", () => {
    it("the bank feed settles, then the rematch job starts again for the same credit: no model call, no second settle, ONE ledger line", async () => {
        const db = moneyDbOf(books())
        settles(db, EXACT.id)
        const { process } = await started(db, bankFeedWake(EXACT.id))
        const asked = db.model.asked.length

        const again = await wake(process, rematchWake(EXACT.id, ORDER))

        expect(again.error).toBeNull()
        const view = await process.threads.stateOf(ref(again.runId ?? ""))
        expect(view?.status).toBe("ended")
        expect(Object.keys(view?.state.steps ?? {})).toEqual(["match"])
        expect(db.model.asked.length).toBe(asked)
        expect(actsOf(db, TOOL.paymentMarkPaid)).toHaveLength(1)
        expect(db.toolCalls.filter((call) => call.tool === TOOL.ledgerAppend)).toHaveLength(1)
        expect([...db.book.keys()]).toEqual([EXACT.id])
    })

    it("killed after the settle acted, before its step was checkpointed: a new process goes on; one settle, ONE ledger line", async () => {
        const db = moneyDbOf(books())
        settles(db, EXACT.id)
        // The process dies on the `done` projection write of the second step (mark-paid): the settle acted and its ledger row exists.
        let done = 0
        db.records.crashOnce((mutation) => {
            if (mutation.entity !== "agent.run-step" || mutation.op !== "update" || mutation.values.status !== "done")
                return false
            done += 1
            return done === 2
        })
        const first = await moneyProcessOf(db)
        const woken = await wake(first, bankFeedWake(EXACT.id))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(actsOf(db, TOOL.paymentMarkPaid)).toHaveLength(1)
        expect(await statusOf(first, runId)).toBe("open")

        // The re-drive runs the unfinished step again; script its model turns once more (a replay may still ask them: D-0-9-1).
        db.model.script(P.settle, calls(TOOL.paymentMarkPaid, { orderId: ORDER, transactionId: EXACT.id }), {
            done: { result: "paid" },
        })
        const second = await moneyProcessOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await statusOf(second, runId)).toBe("ended")
        expect(actsOf(db, TOOL.paymentMarkPaid)).toHaveLength(1)
        expect(db.model.askedOf(P.match)).toHaveLength(1)
        expect([...db.book.keys()]).toEqual([EXACT.id])
        expect(db.team.map((message) => message.versions.at(0)?.kind)).toEqual(["payment.received"])
        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})

describe("reconcile on a thread: what is not clear stops for the founder (DEFAULT = REPORT)", () => {
    it("wrong code + right amount (bank-fed, no lead, no conversation): NOT settled, one line naming no order, one stop, one card", async () => {
        const db = moneyDbOf(books())
        const { process, runId } = await wrongCode(db)

        expect(await statusOf(process, runId)).toBe("stopped")
        expect(actsOf(db, TOOL.paymentMarkPaid)).toEqual([])
        expect(db.book.size).toBe(0)
        expect(db.store.order?.[0]).toMatchObject({ status: "confirmed" })
        expect(db.store["bank-transaction"]?.find((row) => row.id === WRONG_CODE.id)).toMatchObject({
            orderId: null,
            status: "unmatched",
        })
        expect(linesOf(db)).toEqual([CHECKING])
        expect(linesOf(db)[0]).not.toMatch(/DH-?1|DH9999/i)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state, stop.leadId, stop.conversationId])).toEqual([
            ["match", "ai_report", "open", null, null],
        ])
        expect(db.team).toHaveLength(1)
        expect(stops[0]?.cardMessageId).toBe(db.team[0]?.id)
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "waiting" })
    })

    it("the stop remembers the line the step told the order's customer (bank-fed: a conversation the run does not have)", async () => {
        const db = moneyDbOf(books())
        const { process, runId } = await wrongCode(db)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.customerLines.map((line) => [line.conversationId, line.text])).toEqual([["conv-1", CHECKING]])
    })

    it("a confused stop is never auto-resumed: three re-drives move nothing, ask no model, send nothing", async () => {
        const db = moneyDbOf(books())
        const { process, runId } = await wrongCode(db)
        const asked = db.model.asked.length

        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        await redrive(process, runId, "sweep-3")

        expect(await statusOf(process, runId)).toBe("stopped")
        expect(db.model.asked.length).toBe(asked)
        expect(linesOf(db)).toEqual([CHECKING])
        expect((await stopsOf(process, runId)).map((stop) => stop.repeats)).toEqual([1])
        expect(db.team).toHaveLength(1)
    })

    it("the founder's free-text answer resumes the bank-fed stop: the match sees the words, settles; one settle, one ledger line, one card", async () => {
        const db = moneyDbOf(books())
        const { process, runId } = await wrongCode(db)
        settles(db, WRONG_CODE.id)

        const ran = await founderDecides(process, runId, answer(db, "Dung roi, do la tien don DH-1, ghi nhan di"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(P.match).at(-1)?.request.input)).toContain("ghi nhan di")
        const view = await process.threads.stateOf(ref(runId))
        expect(view?.status).toBe("ended")
        expect(Object.keys(view?.state.steps ?? {})).toEqual(PAID_PATH)
        expect(actsOf(db, TOOL.paymentMarkPaid).map((act) => act.payload)).toEqual([
            { orderId: ORDER, transactionId: WRONG_CODE.id },
        ])
        expect([...db.book.keys()]).toEqual([WRONG_CODE.id])
        expect(linesOf(db)).toEqual([CHECKING])
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ state: "resolved", decision: { kind: "answer" } })
        // The stop's card is rewritten in place; the paid card is the only other message.
        expect(db.team.map((message) => message.key)).toEqual([`run-stuck:${runId}:match`, expect.any(String)])
        // One card, rewritten in place (P6's typed card): its last version carries the founder's reply; never a second card.
        expect(db.team[0]?.versions.length).toBeGreaterThan(1)
        expect(JSON.stringify(db.team[0]?.versions.at(-1))).toContain("ghi nhan di")
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("reconcile on a thread: short and over transfers stop for the founder", () => {
    it("short transfer: one line to the customer and a stop; a retry with no words cannot make a second line", async () => {
        const db = moneyDbOf(books())
        db.model.script(
            P.match,
            calls(TOOL.customerMessageSend, { leadId: "lead-1", text: SHORT_LINE }),
            confused("Khach chuyen thieu 3.000d cho don DH-1, xu ly sao?"),
        )
        db.model.script(P.core, report("Khach chuyen thieu 3.000d cho don DH-1, xu ly sao?"))
        const { process, runId } = await started(db, bankFeedWake(SHORT.id))
        expect(await statusOf(process, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([SHORT_LINE])
        expect(actsOf(db, TOOL.paymentMarkPaid)).toEqual([])

        // Retry: the step runs again, words differ, the door refuses a second line for the same stop; the step stops again.
        db.model.script(
            P.match,
            calls(TOOL.customerMessageSend, { leadId: "lead-1", text: "Shop van dang kiem tra a!" }),
            confused("Van thieu 3.000d"),
        )
        db.model.script(P.core, report("Van thieu 3.000d"))
        await founderDecides(process, runId, button(db, "retry"))

        expect(linesOf(db)).toEqual([SHORT_LINE])
        expect(JSON.stringify(db.model.askedOf(P.match).at(-1)?.request)).toContain("already_told_for_this_stop")
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.state, stop.repeats])).toEqual([["match", "open", 2]])
        expect(db.team).toHaveLength(1)
        expect(actsOf(db, TOOL.paymentMarkPaid)).toEqual([])
    })

    it("over-payment: the match does not settle, it stops for the founder with the facts; the order stays open", async () => {
        const db = moneyDbOf(books())
        db.model.script(P.match, confused("Khach chuyen du 2.000d cho don DH-1, ghi nhan va hoan lai?"))
        db.model.script(P.core, report("Khach chuyen du 2.000d cho don DH-1, ghi nhan va hoan lai?"))
        const { process, runId } = await started(db, bankFeedWake(OVER.id))

        expect(await statusOf(process, runId)).toBe("stopped")
        expect(actsOf(db, TOOL.paymentMarkPaid)).toEqual([])
        expect(db.book.size).toBe(0)
        expect(db.store.order?.[0]).toMatchObject({ status: "confirmed" })
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["match", "ai_report", "open"],
        ])
        expect(db.team).toHaveLength(1)
    })
})

describe("reconcile on a thread: the stop rules", () => {
    it("one record per run + step: a second stop of the same step after an answer folds into it (one record, one card)", async () => {
        const db = moneyDbOf(books())
        db.model.script(P.match, confused("Khoan nay cua don nao?"), confused("Van chua ro"))
        db.model.script(P.core, report("Khoan nay cua don nao?"), report("Van chua ro"))
        const { process, runId } = await started(db, bankFeedWake(WRONG_CODE.id))

        await founderDecides(process, runId, answer(db, "Khong biet, de toi xem"))

        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ stepKey: "match", state: "open", repeats: 2 })
        expect(stop?.answers.map((one) => one.text)).toEqual(["Khong biet, de toi xem"])
        expect(db.team).toHaveLength(1)
    })

    it("no automatic compensation: a stop after the settle undoes nothing; skip ends the run and leaves the settle as it is", async () => {
        const db = moneyDbOf(books())
        db.model.script(P.match, {
            done: { transactionId: EXACT.id, orderId: ORDER, claimId: null, settle: true, reason: "Khop" },
        })
        db.model.script(P.settle, calls(TOOL.paymentMarkPaid, { orderId: ORDER, transactionId: EXACT.id }), {
            done: { result: "paid" },
        })
        db.model.script(P.post, confused("Bang tinh so sach khong mo duoc"))
        db.model.script(P.core, report("Bang tinh so sach khong mo duoc, ghi tay?"))
        const { process, runId } = await started(db, bankFeedWake(EXACT.id))

        expect(await statusOf(process, runId)).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["ledger"])
        const undo = [TOOL.orderVoid, "order.cancel", "payment.claim.cancel", TOOL.ledgerVoid]
        expect(db.acts.filter((act) => undo.includes(act.effect))).toEqual([])
        expect(db.store.order?.[0]).toMatchObject({ status: "paid" })

        await founderDecides(process, runId, button(db, "skip"))

        expect(await statusOf(process, runId)).toBe("ended")
        expect(db.acts.filter((act) => undo.includes(act.effect))).toEqual([])
        expect(db.toolCalls.filter((call) => undo.includes(call.tool))).toEqual([])
        expect(actsOf(db, TOOL.paymentMarkPaid)).toHaveLength(1)
        expect(db.store.order?.[0]).toMatchObject({ status: "paid" })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        expect(db.runs.get(runId)?.agentId).toBe(ACCOUNTING)
    })
})
