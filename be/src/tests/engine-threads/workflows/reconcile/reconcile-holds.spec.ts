import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    CONV,
    UNDERSTAND,
    answer,
    customerWrites,
    drain,
    founderDecides,
    stopsOf,
    type ThreadProcess,
} from "../../thread-world"
import { P, bankFeedWake, calls, linesOf, moneyDbOf, wake, type MoneyDb } from "./thread-world-money"
import { freezesOf, holdProvidersOf } from "./thread-world-money-holds"
import { moneyProcessOf } from "./thread-world-money-process"

// FX3, D-P11-4 (live on restart FIFTEEN, G6): a BANK-FED reconcile run (no lead, no conversation) stopped at `match` after telling the
// order's customer one "checking" line. The customer wrote again; nothing held them (the stop named no customer), so the front desk
// handed off to a SECOND reconcile on the same money, which told them twice more. The rule: while a stop is open, new lines of the
// customer the stopped step messaged are HELD, and replayed once after the founder answers. Here with the REAL lead-freezes composed.

const ORDER = "order-1"
const OWES = 4000
const WRONG = {
    id: "tx-wrong",
    amountVnd: OWES,
    reference: "DH9999 chuyen tien",
    payer: "NGUYEN THI LAN",
    occurredAt: "2026-11-10T10:00:00.000Z",
    orderId: null,
    status: "unmatched",
}
const books = () => ({
    order: [
        {
            id: ORDER,
            orderNo: "DH-1",
            leadId: "lead-1",
            items: [],
            amountVnd: OWES,
            status: "confirmed",
            confirmedAt: "2026-11-10T09:00:00.000Z",
            createdAt: "2026-11-10T08:00:00.000Z",
        },
    ],
    "bank-transaction": [{ ...WRONG }],
})

const CHECKING = "Shop da nhan khoan chuyen 4.000d cua ban, shop dang kiem tra va se bao lai ngay a."
const AGAIN = "Shop oi minh vua chuyen 4.000d do, shop kiem tra giup minh nha"
const QUESTION = "Khoan 4.000d ma DH9999 co phai cua don DH-1?"
const REPLY = "Da shop da ghi nhan khoan 4.000d cho don cua ban roi a."

const report = {
    decision: "report",
    reason: "Khoan tien chua ro la cua don nao.",
    question: QUESTION,
    suggestions: [{ text: "Ghi nhan cho don DH-1", handledBy: "workflow" }],
    customerLine: null,
}

/** The match settles the credit onto the order after the founder's words; settle, ledger and the paid card follow. */
const settles = (db: MoneyDb) => {
    db.model.script(P.match, {
        done: { transactionId: WRONG.id, orderId: ORDER, claimId: null, settle: true, reason: "Chu tiem xac nhan" },
    })
    db.model.script(P.settle, calls(TOOL.paymentMarkPaid, { orderId: ORDER, transactionId: WRONG.id }), {
        done: { result: "paid" },
    })
    db.model.script(P.post, calls(TOOL.ledgerAppend, { transactionId: WRONG.id }), { done: { ref: "sheet-row-1" } })
    db.model.script(P.paidNotice, calls(TOOL.teamMessagePost, { kind: "payment.received", orderId: ORDER }), {
        done: { posted: true },
    })
}

/** The live sequence up to the stop: the bank feed's credit, the match tells the order's customer one line, then reports. */
const stoppedBankFed = async (): Promise<{ readonly db: MoneyDb; readonly process: ThreadProcess; readonly runId: string }> => {
    const db = moneyDbOf(books())
    const process = await moneyProcessOf(db, holdProvidersOf(db))
    db.model.script(P.match, calls(TOOL.customerMessageSend, { leadId: "lead-1", text: CHECKING }), {
        confused: { reason: "Chua ro", question: QUESTION },
    })
    db.model.script(P.core, report)
    const woken = await wake(process, bankFeedWake(WRONG.id))
    expect(woken.error).toBeNull()
    return { db, process, runId: woken.runId ?? "" }
}

describe("reconcile on a thread: the customer a bank-fed stop told is held until the founder answers (D-P11-4)", () => {
    it("the stop takes the customer its step told: the run names none, the stop names their lead and conversation", async () => {
        const { process, runId, db } = await stoppedBankFed()

        expect(linesOf(db)).toEqual([CHECKING])
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.state, stop.leadId, stop.conversationId])).toEqual([
            ["match", "open", "lead-1", CONV],
        ])
        expect(db.runs.get(runId)?.context).not.toHaveProperty("leadId")
    })

    it("LIVE: the customer writes again → no new run, no model call, no line; the line is held on the stop's run", async () => {
        const { db, process, runId } = await stoppedBankFed()
        const runs = db.runs.size
        const asked = db.model.asked.length

        const again = await customerWrites(process, AGAIN)

        expect(again.error).toBeNull()
        expect(again.ending).toMatchObject({ status: "held" })
        expect(again.runId).toBeNull()
        expect(db.runs.size).toBe(runs)
        expect(db.model.asked.length).toBe(asked)
        expect(linesOf(db)).toEqual([CHECKING])
        expect(actsOfSend(db)).toHaveLength(1)
        expect(freezesOf(db)).toEqual([
            expect.objectContaining({
                status: "frozen",
                frozenRunId: runId,
                stepKey: "match",
                leadId: "lead-1",
                pending: { events: [expect.objectContaining({ kind: "message", source: "customer" })] },
            }),
        ])
    })

    it("LIVE: the founder answers → the stop resolves, the held line is replayed ONCE as a new front-desk wake; nothing replays twice", async () => {
        const { db, process, runId } = await stoppedBankFed()
        await customerWrites(process, AGAIN)
        settles(db)

        const from = db.wakes.length
        const ran = await founderDecides(process, runId, answer(db, "Dung roi, do la tien don DH-1, ghi nhan di"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await stopsOf(process, runId)).map((stop) => stop.state)).toEqual(["resolved"])
        expect(actsOfPaid(db)).toHaveLength(1)
        // The resume wake, then the replay of the held line (written by the release after the drive settled).
        const replayed = db.wakes.slice(from).filter((one) => one.source === "customer")
        expect(replayed).toHaveLength(1)
        expect(freezesOf(db)).toEqual([expect.objectContaining({ status: "released", releaseReason: "stop_closed" })])

        // The replayed line runs the front desk once, now that nothing is open: one answer, the second line the customer gets.
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: da chuyen 4.000d" } })
        db.model.script(ANSWER, calls(TOOL.customerMessageSend, { conversationId: CONV, text: REPLY }), {
            done: { reply: REPLY },
        })
        const runs = db.runs.size
        const replay = await drain(process, db.wakes.length - 1)

        expect(replay.map((one) => [one.error, one.ending?.status])).toEqual([[null, "done"]])
        expect(db.runs.size).toBe(runs + 1)
        expect(linesOf(db)).toEqual([CHECKING, REPLY])
        // No second reconcile ever ran on the same money; the released hold writes no wake again.
        expect([...db.runs.values()].filter((run) => run.agentId === "accounting-agent")).toHaveLength(1)
        expect(db.wakes.filter((one) => one.source === "customer")).toHaveLength(1)
    })
})

// D-FX3-1 (separate root, written up in LG-REQUESTS "## FX3 output"): a NEW wake for the same credit while its stop is open (the rematch
// job's start, keyed per order, carries only `transactionId`) names no customer and no `subject`, so no hold sees it; it opens a second
// reconcile on the same money. The fix needs the stop to name what its run is about (the credit), not who it told.
it.todo("D-FX3-1: a rematch start for a credit whose reconcile stop is open is held on that stop (no second run on the same money)")

/** The customer sends the world acted. */
const actsOfSend = (db: MoneyDb) => db.acts.filter((act) => act.effect === TOOL.customerMessageSend)

/** The settles the world acted. */
const actsOfPaid = (db: MoneyDb) => db.acts.filter((act) => act.effect === TOOL.paymentMarkPaid)
