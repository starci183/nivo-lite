import { TOOL } from "@nivo-lite/blocks-core"
import { CONV, actsOf, playOld, redrive, rowsOf, stopsOf, type ThreadProcess } from "../../thread-world"
import {
    ACCOUNTING,
    AFTER_SALE_WORKFLOW,
    CONSULT_WORKFLOW,
    P,
    RECONCILE_WORKFLOW,
    SALES,
    bankFeedWake,
    calls,
    consultWake,
    handOffWake,
    linesOf,
    moneyDbOf,
    wake,
    type MoneyDb,
} from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"

// Package P7 (design row 1-8): `sales.consult` on a LangGraph thread — the consult turns, the order, the QR — the same walk on the old
// engine and on a thread (twin), a kill in the middle of the consult and its continuation, and the whole baseline of 8.1 across the
// workflows: order → QR → wait → the transfer arrives → settled → ledger line → paid card → the hand-off to the after-sale.

const SUMMARY =
    "Chi Lan oi, shop tom tat: 2 gio hoa nho, giao 25 Nguyen Hue, chi Lan 0901 234 567, thu Bay 9-11h. Chi dong y nhe?"
const THANKS = "Shop da nhan thanh toan don DH-1, cam on chi Lan! Shop giao thu Bay 9-11h nhe."
const catalogue = {
    id: "c1",
    name: "Gio hoa nho",
    priceVnd: 2000,
    active: true,
    imageUrl: "https://files.example/c1.jpg",
}
const ASKED = {
    branch: "asked",
    leadId: "lead-1",
    items: [],
    address: null,
    recipientName: null,
    recipientPhone: null,
    deliveryAt: null,
}
const DRAFT = {
    address: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "Saturday 9-11",
}
const READY = { branch: "ready", leadId: "lead-1", items: [{ catalogueItemId: "c1", quantity: 2 }], ...DRAFT }

/** Turn 1: the consult sends the summary and asks the customer to agree; the run ends at the consult (`asked` is not routed). */
const asks = (db: MoneyDb) =>
    db.model.script(P.consult, calls(TOOL.customerMessageSend, { conversationId: CONV, text: SUMMARY }), {
        done: ASKED,
    })

/** Turn 2: the customer agreed: ready → the order is recorded and confirmed, the QR sent with its two reminders, the team told. */
const orders = (db: MoneyDb) => {
    db.model.script(P.consult, { done: READY })
    db.model.script(
        P.createOrder,
        calls(TOOL.orderRecord, { leadId: "lead-1", items: [{ catalogueItemId: "c1", qty: 2 }], ...DRAFT }),
        calls(TOOL.orderConfirm, { orderId: "order-1" }),
        calls(TOOL.leadStageUpdate, { leadId: "lead-1", stage: "won" }),
        { done: { orderId: "order-1", orderNo: "DH-1" } },
    )
    db.model.script(
        P.sendQr,
        calls(TOOL.paymentQrCreate, { orderId: "order-1" }),
        calls(TOOL.careSchedule, { kind: "payment-reminder", ref: "order-1", afterHours: 2 }),
        calls(TOOL.careSchedule, { kind: "payment-stale", ref: "order-1", afterHours: 24 }),
        { done: { orderId: "order-1", sent: true } },
    )
    db.model.script(P.orderNotice, calls(TOOL.teamMessagePost, { kind: "order.summary", orderId: "order-1" }), {
        done: { posted: true },
    })
}

const ORDER_PATH = ["consult", "create-order", "send-qr", "notify-order", "won"]
const ORDER_ACTS = [
    TOOL.orderRecord,
    TOOL.orderConfirm,
    TOOL.leadStageUpdate,
    TOOL.paymentQrCreate,
    TOOL.careSchedule,
    TOOL.careSchedule,
    TOOL.teamMessagePost,
]

const WS = "11111111-1111-4111-8111-111111111111"
const statusOf = async (process: ThreadProcess, runId: string) =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.status
const stepsOf = async (process: ThreadProcess, runId: string) =>
    Object.keys((await process.threads.stateOf({ workspaceId: WS, runId }))?.state.steps ?? {})

/** What a walk left in the world, comparable across engines. */
const outcomeOf = (db: MoneyDb) => ({
    acts: db.acts.map((act) => ({ effect: act.effect, payload: act.payload, key: act.key, dedupeKey: act.dedupeKey })),
    lines: db.lines.map((line) => ({
        conversationId: line.conversationId,
        text: line.text,
        channelRef: line.channelRef,
    })),
    team: db.team.map((message) => ({ key: message.key, versions: message.versions })),
    // The order rows without their clock stamps (the clock ticks on every read; the two engines read it a different number of times).
    orders: db.store.order?.map(({ createdAt: _created, confirmedAt: _confirmed, ...row }) => row),
    ledger: db.records.of("agent.node-effect").map((row) => row.data),
    modelAsked: db.model.asked.map((one) => one.purpose),
})

const books = () => ({ "catalogue-item": [{ ...catalogue }] })

/** The two consult turns of a customer on one engine: `flag` empty plays the old engine (its step handler), else the thread. */
const twoTurns = async (thread: boolean) => {
    const db = moneyDbOf(books())
    asks(db)
    orders(db)
    const process = await moneyProcessOf(db, thread ? [CONSULT_WORKFLOW] : [])
    const first = await wake(process, consultWake("Cho chi 2 gio hoa nho giao thu Bay"))
    const firstPath = thread
        ? await stepsOf(process, first.runId ?? "")
        : (await playOld(process, first.runId ?? "")).path
    const second = await wake(process, consultWake("Dong y nhe em", "call-workflow:turn-1:sales.consult"))
    const secondPath = thread
        ? await stepsOf(process, second.runId ?? "")
        : (await playOld(process, second.runId ?? "")).path
    return { db, process, first, second, paths: [firstPath, secondPath] }
}

describe("consult on a thread: twin walk with the old engine", () => {
    it("two turns (asked, then ready → order → QR → team): same steps, acts, customer lines, cards and orders on both engines", async () => {
        const old = await twoTurns(false)
        const thread = await twoTurns(true)

        expect([old.first.error, old.second.error, thread.first.error, thread.second.error]).toEqual([
            null,
            null,
            null,
            null,
        ])
        expect(old.paths).toEqual([["consult"], ORDER_PATH])
        expect(thread.paths).toEqual(old.paths)
        expect(await statusOf(thread.process, thread.second.runId ?? "")).toBe("ended")
        expect(outcomeOf(thread.db)).toEqual(outcomeOf(old.db))
        expect(thread.db.acts.map((act) => act.effect)).toEqual([TOOL.customerMessageSend, ...ORDER_ACTS])
        expect(linesOf(thread.db)).toEqual([SUMMARY])
        expect(thread.db.store.order).toEqual([
            expect.objectContaining({ id: "order-1", orderNo: "DH-1", status: "confirmed", amountVnd: 4000 }),
        ])
        expect(thread.db.model.asked.length).toBe(old.db.model.asked.length)
        for (const runId of [thread.first.runId ?? "", thread.second.runId ?? ""])
            expect(rowsOf(thread.db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("consult on a thread: killed in the middle and continued", () => {
    /** The process dies on the `done` projection write of the n-th step of the run: that step acted, its checkpoint is not written. */
    const diesAtDone = (db: MoneyDb, nth: number) => {
        let done = 0
        db.records.crashOnce((mutation) => {
            if (mutation.entity !== "agent.run-step" || mutation.op !== "update" || mutation.values.status !== "done")
                return false
            done += 1
            return done === nth
        })
    }

    it("killed after the QR was sent (third step): a new process goes on from there; no effect twice, no line twice", async () => {
        const db = moneyDbOf(books())
        orders(db)
        diesAtDone(db, 3)
        const first = await moneyProcessOf(db, [CONSULT_WORKFLOW])
        const woken = await wake(first, consultWake("Dong y nhe em"))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(actsOf(db, TOOL.paymentQrCreate)).toHaveLength(1)
        expect(await statusOf(first, runId)).toBe("open")

        // The unfinished step may ask its model again on the re-drive (D-0-9-1); the ledger answers its effects.
        db.model.script(
            P.sendQr,
            calls(TOOL.paymentQrCreate, { orderId: "order-1" }),
            calls(TOOL.careSchedule, { kind: "payment-reminder", ref: "order-1", afterHours: 2 }),
            calls(TOOL.careSchedule, { kind: "payment-stale", ref: "order-1", afterHours: 24 }),
            { done: { orderId: "order-1", sent: true } },
        )
        const second = await moneyProcessOf(db, [CONSULT_WORKFLOW])
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await statusOf(second, runId)).toBe("ended")
        expect(await stepsOf(second, runId)).toEqual(ORDER_PATH)
        expect(db.acts.map((act) => act.effect)).toEqual(ORDER_ACTS)
        expect(db.model.askedOf(P.consult)).toHaveLength(1)
        expect(db.model.askedOf(P.createOrder)).toHaveLength(4)
        expect(db.store.order).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
        expect(await stopsOf(second, runId)).toEqual([])
    })

    it("killed inside the consult step after it told the customer: the re-driven consult does not tell them twice", async () => {
        const db = moneyDbOf(books())
        asks(db)
        asks(db)
        diesAtDone(db, 1)
        const first = await moneyProcessOf(db, [CONSULT_WORKFLOW])
        const woken = await wake(first, consultWake("Cho chi 2 gio hoa nho giao thu Bay"))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(linesOf(db)).toEqual([SUMMARY])

        const second = await moneyProcessOf(db, [CONSULT_WORKFLOW])
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await statusOf(second, runId)).toBe("ended")
        expect(linesOf(db)).toEqual([SUMMARY])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
    })
})

describe("the money walk across workflows (8.1 baseline): order → QR → wait → paid → ledger → paid card → thank-you", () => {
    it("one order, one QR, ONE settle, ONE ledger line keyed by the transaction, one paid card, one thank-you reading the paid order", async () => {
        const db = moneyDbOf(books())
        orders(db)
        const process = await moneyProcessOf(db, [CONSULT_WORKFLOW, RECONCILE_WORKFLOW, AFTER_SALE_WORKFLOW])
        const ordered = await wake(process, consultWake("Dong y nhe em"))
        expect(await statusOf(process, ordered.runId ?? "")).toBe("ended")
        // Wait: the order is confirmed and owes its total; nothing reconciles before money arrives.
        expect(db.store.order?.[0]).toMatchObject({ id: "order-1", status: "confirmed", amountVnd: 4000 })
        expect(actsOf(db, TOOL.paymentMarkPaid)).toEqual([])

        db.store["bank-transaction"]?.push({
            id: "tx-1",
            amountVnd: 4000,
            reference: "DH1",
            payer: "NGUYEN THI LAN",
            occurredAt: "2026-11-10T10:30:00.000Z",
            orderId: null,
            status: "unmatched",
        })
        db.model.script(P.match, {
            done: {
                transactionId: "tx-1",
                orderId: "order-1",
                claimId: null,
                settle: true,
                reason: "Ma DH1, du 4.000d",
            },
        })
        db.model.script(P.settle, calls(TOOL.paymentMarkPaid, { orderId: "order-1", transactionId: "tx-1" }), {
            done: { result: "paid" },
        })
        db.model.script(P.post, calls(TOOL.ledgerAppend, { transactionId: "tx-1" }), { done: { ref: "sheet-row-1" } })
        db.model.script(P.paidNotice, calls(TOOL.teamMessagePost, { kind: "payment.received", orderId: "order-1" }), {
            done: { posted: true },
        })
        const paid = await wake(process, bankFeedWake("tx-1"))

        expect(paid.error).toBeNull()
        expect(await statusOf(process, paid.runId ?? "")).toBe("ended")
        expect(db.store.order?.[0]).toMatchObject({ status: "paid" })
        expect(actsOf(db, TOOL.orderRecord)).toHaveLength(1)
        expect(actsOf(db, TOOL.paymentQrCreate)).toHaveLength(1)
        expect(actsOf(db, TOOL.paymentMarkPaid)).toHaveLength(1)
        expect([...db.book.entries()]).toEqual([["tx-1", "sheet-row-1"]])
        expect(db.team.map((message) => message.versions.at(0)?.kind)).toEqual(["order.summary", "payment.received"])
        const [handOff] = actsOf(db, TOOL.agentTag)
        expect(handOff?.payload).toMatchObject({
            toModuleKey: "sales",
            context: { params: { orderId: "order-1", leadId: "lead-1" } },
        })
        if (handOff === undefined) return

        // Thank-you: the hand-off wakes the sales agent's after-sale workflow (by its pin, as the tag door writes it) on a thread.
        db.model.script(
            P.afterSale,
            calls(TOOL.customerMessageSend, { leadId: "lead-1", text: THANKS }),
            calls(TOOL.leadUpdate, { leadId: "lead-1", consultStage: "after_sale" }),
            { done: { orderId: "order-1", sent: true } },
        )
        db.model.script(P.carePlanDay, { answer: { deliverOn: "2026-11-14" } })
        const thanked = await wake(process, handOffWake(handOff, ACCOUNTING))

        expect(thanked.error).toBeNull()
        expect(db.runs.get(thanked.runId ?? "")?.agentId).toBe(SALES)
        expect(await statusOf(process, thanked.runId ?? "")).toBe("ended")
        expect(await stepsOf(process, thanked.runId ?? "")).toEqual(["thank", "plan", "thanked"])
        // The thank-you step read the paid order's row (its number and status), and the customer got one thank-you line.
        expect(JSON.stringify(db.model.askedOf(P.afterSale)[0]?.request.input)).toContain("DH-1")
        expect(JSON.stringify(db.model.askedOf(P.afterSale)[0]?.request.input)).toContain("paid")
        expect(linesOf(db)).toEqual([THANKS])
    })
})
