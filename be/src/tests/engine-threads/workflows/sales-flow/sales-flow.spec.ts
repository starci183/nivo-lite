import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { CONTACT, CONV, actsOf, customersSay, drain, itemsOf, runTurns, stopsOf } from "../../thread-world"
import { calledWorkflow, websiteSubmitted } from "../../thread-world-intake"
import { SALES } from "../reconcile/thread-world-money"
import { WS } from "../../thread-world-records"
import { threadStepsOf } from "../../thread-world-w8-wakes"
import { SP, creditArrives, customerSaysToSale, handedToConsult, qrOf, saidOf, salesWorldOf, toldOf, type WorldCredit } from "./thread-world-sales"

// THE SALE AS ONE RUN (owner's final rule 7, `sales.consult` v23): the front desk hands the person to Sales and ends; the sale's run talks in a loop
// (the consult answers, the run PARKS at `hear` for the person's next line, a day at most), records the order, sends the transfer QR, and parks
// again in a payment loop (`await`: the bank's credit that names the order's code, or a line of the person, 24 h at most). The hand-off is the real
// `deliver` of `workflow.called`; every later line of the person is the real Zalo entry, taken by the parked run's wait before any registered graph.

const TRUTHS = [
    { id: "fact-basket", subject: "Gio hoa nho", attribute: "gia", value: "2000 d", unit: null, num: 2000 },
    { id: "fact-pay", subject: "thanh toan", attribute: "chuyen khoan", value: "ACB 123456, Hoa Shop" },
]
const SUMMARY = "Chi Lan oi, shop tom tat: 2 gio hoa nho (2.000 d/gio), giao 25 Nguyen Hue, chi Lan 0901 234 567, thu Bay 9-11h. Chi dong y nhe?"
const TOLD = "Don DH-20261113-0001 da ghi: 2 gio hoa nho, tong 4.000 d. Chi chuyen khoan ACB 123456 (Hoa Shop), noi dung DH-20261113-0001 nhe."
const NONE = { occasions: null, cancelOrderId: null, cancelReason: null }
const DELIVERY = { address: "25 Nguyen Hue", recipientName: "Lan", recipientPhone: "0901 234 567", deliveryAt: "thu Bay 9-11h" }
const LINES = [{ name: "Gio hoa nho", quantity: 2, unitVnd: 2000 }]
const ASKED = { branch: "asked", reply: SUMMARY, items: LINES, ...DELIVERY, ...NONE }
const READY = { branch: "ready", reply: null, items: LINES, ...DELIVERY, ...NONE }
const searches = (query: string) => ({ call: { tool: TOOL.brainSearch, args: { query } } })

/** The sale up to the order: the consult asks, the person agrees, the order is recorded and told; the run parks at the payment wait. */
const ordered = async () => {
    const world = await salesWorldOf(TRUTHS)
    const { db } = world
    db.model.script(SP.consult, searches("gio hoa nho gia"), { done: ASKED })
    const first = await handedToConsult(world, "2 gio hoa nho giao 25 Nguyen Hue, chi Lan 0901 234 567, thu Bay 9-11h")
    expect(first?.error).toBeNull()
    db.model.script(SP.consult, { done: READY })
    db.model.script(SP.orderTell, searches("cach thanh toan chuyen khoan"), { done: { text: TOLD } })
    const agreed = await customerSaysToSale(world, "Dong y", "m-agree-1")
    expect(agreed.resumed.map((one) => one.error)).toEqual([null])
    return { world, runId: first?.runId ?? "" }
}

describe("the sale as one run: from the hand-off to the recorded order", () => {
    it("asks with the truth's price, parks for the person, then records the order, tells its code and exact total and parks for the money", async () => {
        const { world, runId } = await ordered()
        const { db, books, process } = world

        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["talk[r1].consult", "talk[r2].hear", "talk[r2].consult"]))
        // ONE run served the whole sale; the front desk started none (it was only handed the line by the wait).
        expect([...db.runs.keys()]).toEqual([runId])
        expect(books.calls.filter((one) => one.tool === TOOL.brainSearch).map((one) => one.args)).toEqual([
            { query: "gio hoa nho gia" },
            { query: "cach thanh toan chuyen khoan" },
        ])
        expect([...books.orders.values()].map((one) => one.values)).toEqual([
            expect.objectContaining({
                contactId: CONTACT,
                amountVnd: 4000,
                status: "confirmed",
                orderNo: "DH-20261113-0001",
                recipientName: "Lan",
                deliveryAddress: "25 Nguyen Hue",
            }),
        ])
        // The customer heard the summary, then the order's code, exact total and how to pay, the order message carrying the QR picture.
        expect(saidOf(db)).toEqual([SUMMARY, TOLD])
        expect(db.lines.every((line) => line.conversationId === CONV)).toBe(true)
        expect(books.calls.filter((one) => one.tool === TOOL.paymentTransferCreate).map((one) => one.args)).toEqual([
            { amountVnd: 4000, content: "DH-20261113-0001" },
        ])
        expect(actsOf(db, TOOL.customerMessageSend).at(-1)?.payload).toMatchObject({
            text: TOLD,
            images: [{ url: qrOf(4000, "DH-20261113-0001").qrImageUrl, caption: "" }],
        })
        // No separate reminder timer exists any more: the reminder is the payment wait's own timeout.
        expect(books.timers.size).toBe(0)
        expect(db.team).toEqual([])
        // The run is parked (not ended): it waits for the credit or a line.
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch).not.toEqual(null)
    })
})

/**
 * R68 (sale v30): the team posts of an unsuccessful ending are the ENGINE's (`report.facts`, under the key `step-ending:<run>:<step>:<attempt>`),
 * no longer a notice node's catalogue line. A world recognises one by its KIND and its FACTS (the step's declared notice facts, by their label in the
 * team's language), never by its wording.
 */
const ENDING_KEY = "step-ending:"
type TeamPost = { readonly key: string; readonly versions: ReadonlyArray<Readonly<Record<string, unknown>>> }
const isEnding = (post: TeamPost): boolean => post.key.startsWith(ENDING_KEY)
/** The facts of an engine notice by their label. */
const endingFactsOf = (post: TeamPost | undefined): Readonly<Record<string, string>> => {
    const facts: unknown = post?.versions.at(-1)?.facts
    if (!Array.isArray(facts)) return {}
    return Object.fromEntries(
        facts.flatMap((fact: unknown) =>
            typeof fact === "object" && fact !== null && typeof Reflect.get(fact, "name") === "string"
                ? [[String(Reflect.get(fact, "name")), String(Reflect.get(fact, "value"))]]
                : [],
        ),
    )
}
/** The engine notice is a facts card naming the order's code (and, when given, more facts). */
const expectEndingOf = (post: TeamPost | undefined, facts: Readonly<Record<string, string>> = { "Mã đơn": "DH-20261113-0001" }): void => {
    expect(post === undefined ? false : isEnding(post)).toBe(true)
    expect(post?.versions.at(-1)).toMatchObject({ kind: "report.facts" })
    expect(endingFactsOf(post)).toMatchObject(facts)
}

/** The credit that names the order and pays its exact total. */
const PAYS: WorldCredit = { id: "tx-1", amountVnd: 4000, reference: "CK DH-20261113-0001 Lan", occurredAt: "2026-11-13T09:00:00.000Z" }
/** The credit that names the order with a wrong amount. */
const SHORT: WorldCredit = { id: "tx-2", amountVnd: 3000, reference: "DH-20261113-0001", occurredAt: "2026-11-13T09:05:00.000Z" }
/** A credit that names no order. */
const STRANGER: WorldCredit = { id: "tx-3", amountVnd: 150000, reference: "chuyen tien an trua", occurredAt: "2026-11-13T09:10:00.000Z" }
const SHORT_ASKED = "Chi Lan oi, shop nhan 3.000 d cho don DH-20261113-0001, tong don la 4.000 d. Chi muon xu ly the nao a?"

describe("the sale as one run: the payment wait", () => {
    it("the credit that names the order and its exact total is taken by the parked run: the order is recorded paid, the after-sale is called", async () => {
        const { world, runId } = await ordered()
        const { db, books, process } = world

        const arrived = await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })

        // One wake (the sales agent's: the front desk registers no credit and waits on none), taken by the parked run, which goes on.
        expect(arrived.wakes.map((wake) => wake.agentId)).toEqual(["sales-agent"])
        expect(arrived.ended.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([["done", "wait_took"]])
        expect(arrived.resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, runId)).toEqual(
            expect.arrayContaining(["pay[r1].await", "pay[r1].credit", "pay[r1].exact", "pay[r1].paid-order", "pay", "to-after-sale", "paid"]),
        )
        expect(books.calls.filter((one) => one.tool === TOOL.paymentCreditGet).map((one) => one.args)).toEqual([{ transactionId: PAYS.id }])
        expect(books.orders.get("order-1")?.values.status).toBe("paid")
        // The after-sale is handed the order and the person, as a hand-off of the same agent (the step's tag effect).
        expect(actsOf(db, TOOL.agentTag).map((act) => act.payload)).toEqual([
            expect.objectContaining({
                toModuleKey: "sales",
                context: expect.objectContaining({
                    workflowCall: { workflow: "after-sale", version: "latest" },
                    params: { orderId: "order-1", orderNo: "DH-20261113-0001", contactId: CONTACT },
                    caller: { runId },
                }),
            }),
        ])
        // The same movement delivered again is one wake and one payment: the account keeps it once.
        const again = await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })
        expect(again.wakes).toEqual([])
        expect(books.calls.filter((one) => one.tool === TOOL.paymentCreditGet)).toHaveLength(1)
        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
    })

    it.each([
        ["casso", "tx-casso"],
        ["payos", "tx-payos"],
    ] as const)("a %s credit matching the order is read the same way and pays it", async (feed, id) => {
        const { world } = await ordered()

        const arrived = await creditArrives(world, { id, amountVnd: 4000, content: PAYS.reference, feed })

        expect(arrived.resumed.map((one) => one.error)).toEqual([null])
        expect(world.books.calls.filter((one) => one.tool === TOOL.paymentCreditGet).map((one) => one.args)).toEqual([{ transactionId: id }])
        expect(world.books.orders.get("order-1")?.values.status).toBe("paid")
    })

    it("a credit with the right code and a WRONG amount: not paid, the agent asks the customer with both amounts, the run waits on", async () => {
        const { world, runId } = await ordered()
        const { db, books, process } = world
        db.model.script(SP.short, { done: { text: SHORT_ASKED } })

        const arrived = await creditArrives(world, { id: SHORT.id, amountVnd: SHORT.amountVnd, content: SHORT.reference })

        expect(arrived.resumed.map((one) => one.error)).toEqual([null])
        expect(books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect(books.calls.filter((one) => one.tool === TOOL.recordUpdate)).toEqual([])
        expect(saidOf(db).at(-1)).toBe(SHORT_ASKED)
        expect(db.chat.ledger.rows.at(-1)).toMatchObject({ routeId: CONV, contactId: CONTACT, text: SHORT_ASKED, state: "delivered" })
        expect(JSON.stringify(db.model.askedOf(SP.short).at(-1)?.request)).toContain("3000")
        // RULING R32: the team is told too (the amount and the content the credit carried).
        expect(toldOf(db)).toEqual([expect.stringContaining(SHORT.reference)])
        // The sale is not over: its payment loop goes on to a next round and parks again.
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].await", "pay[r1].credit", "pay[r1].exact", "pay[r1].short"]))
    })

    // RULING R32: a credit naming no order of a waiting sale is told to the team by the graph registered on the bank-credit trigger (no wait of
    // the sale takes it). GREEN since Opus-1f's R44 (a) narrowing fix (06:33): `sales.payment`'s registration takes the credit and tells the team.
    it("a credit naming no order is taken by no wait of the sale: nothing is paid, the team is told its amount and content", async () => {
        const { world } = await ordered()
        const { db, books } = world
        const said = saidOf(db).length

        const arrived = await creditArrives(world, { id: STRANGER.id, amountVnd: STRANGER.amountVnd, content: STRANGER.reference })

        // No wait of the sale takes it (R44 (a): the bank-credit narrowing reads `data.direction`, so a registration now takes a money-IN
        // event): the graph REGISTERED on the credit trigger takes it and runs to its end, instead of the engine ending it with `no_waiter`.
        expect(arrived.wakes.map((one) => one.context)).toEqual([expect.objectContaining({ workflowId: "sales-agent:payment" })])
        expect(arrived.ended.map((one) => one.ending?.status)).toEqual(["done"])
        expect(arrived.resumed).toEqual([])
        expect(books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect(saidOf(db)).toHaveLength(said)
        expect(toldOf(db)).toEqual([expect.stringContaining(STRANGER.reference)])
    })

    // The payment wait takes money IN only (sale graph v24): a movement OUT whose content names the order resumes no run, reads nothing, pays nothing.
    it("money that went OUT on the feed is no payment: no run takes it, nothing is read, paid or told", async () => {
        const { world } = await ordered()
        const { db, books } = world

        const arrived = await creditArrives(world, { id: "tx-out", amountVnd: 4000, content: PAYS.reference, direction: "debit" })

        expect(arrived.resumed).toEqual([])
        expect(books.calls.filter((one) => one.tool === TOOL.paymentCreditGet)).toEqual([])
        expect(books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect(db.team).toEqual([])
    })
})

const ORDER_TALK = "sales.order-talk:agent"
const ABOUT = "Don DH-20261113-0001 tong 4.000 d, chi chuyen khoan ACB 123456 noi dung DH-20261113-0001 la shop thay ngay a."

// R41 Q8 (sale v25): the paid record is the owner's to confirm when the node is `ask`: the card is the engine's approval stop, the person's NO is the
// node's business answer `declined` (the order stays unpaid), and the run must not go on silently: the team is told which order and the run ends
// `declined`, the after-sale never called. The owner's setting is the `asking` switch of the books (the door raises the typed ask for the paid write
// until its fingerprint is approved: the real door's mode verdict is proven in node-tool-door.node-mode.spec); the stop, the item, the verdict and the
// `declined` answer are the REAL approvals and host.
describe("the sale as one run: the paid record declined on its card", () => {
    it("the credit pays the order's exact total, the owner says NO on the card: the order stays unpaid, the team is told its code, the run ends `declined`", async () => {
        const { world, runId } = await ordered()
        const { db, books, process } = world
        books.asking = (call) => call.tool === TOOL.recordUpdate && JSON.stringify(call.args).includes('"paid"')

        const arrived = await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })

        // The write is asked, not made: one approval stop, one owner's item, the order unchanged, nobody told yet.
        expect(arrived.resumed.map((one) => one.error)).toEqual([null])
        expect(books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect((await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state])).toEqual([["approval", "open"]])
        expect(itemsOf(db)).toHaveLength(1)
        // The team's only post is the approval card itself (the engine's, step `pay[r1].paid-order`): nobody is told about a decline yet.
        expect(db.team.map((post) => post.key)).toEqual([expect.stringContaining("pay[r1].paid-order")])
        const cards = db.team.length

        const stop = (await stopsOf(process, runId))[0]
        const from = db.wakes.length
        const admitted = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: stop?.stepKey ?? "", workItemId: itemsOf(db)[0]?.item.id ?? "", verdict: "refused", by: "owner-1", text: "" },
            process.requests,
        )
        expect(admitted).toMatchObject({ kind: "admitted" })
        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(books.orders.get("order-1")?.values.status).toBe("confirmed")
        const steps = await threadStepsOf(process, runId)
        // v30 (R68): `paid-order` declares its ending (end at `declined`): the engine tells the team and goes to the outcome.
        expect(steps).toEqual(expect.arrayContaining(["pay[r1].paid-order"]))
        expect(steps).not.toContain("to-after-sale")
        expect(actsOf(db, TOOL.agentTag)).toEqual([])
        // One more post than the card: the engine's notice of the declined step, naming the order's code.
        expect(db.team).toHaveLength(cards + 1)
        expectEndingOf(db.team.at(-1))
        // The run ended on its `declined` outcome (the last step), not parked and not `paid`.
        expect(steps.at(-1)).toBe("declined")
        expect(db.records.get(AGENT_RUNS, runId)?.data).toMatchObject({ status: "done" })
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch ?? null).toBeNull()
        expect((await stopsOf(process, runId)).map((one) => one.state)).toEqual(["resolved"])
    })
})

describe("the sale as one run: a line of the person while the money is awaited", () => {
    it("a line about the order is answered by the sale and the run waits on for the money", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        db.model.script(ORDER_TALK, { done: { topic: "about", reply: ABOUT } })

        const said = await customerSaysToSale(world, "Don cua em tong bao nhieu va chuyen o dau a?", "m-ask-2")

        expect(said.ended.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([
            ["done", "wait_took"],
            ["skipped", "no_waiter"],
        ])
        expect(said.resumed.map((one) => one.error)).toEqual([null])
        expect(saidOf(db).at(-1)).toBe(ABOUT)
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].await", "pay[r1].order-talk"]))
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch).not.toEqual(null)
        // The front desk answered nothing and started no run: the sale kept the line.
        expect([...db.runs.keys()]).toEqual([runId])
        // The order still waits: the credit that comes next pays it in the next round.
        const paid = await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })
        expect(paid.resumed.map((one) => one.error)).toEqual([null])
        expect(world.books.orders.get("order-1")?.values.status).toBe("paid")
    })

    it("a line NOT about the order is given back: the front desk, which waited for it too, takes it and answers; the sale goes on waiting", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        db.model.script(ORDER_TALK, { done: { topic: "off", reply: null } })
        db.model.script("chatbot.understand:agent", { done: { branch: "question", summary: "Lan: gio mo cua" } })

        const said = await customerSaysToSale(world, "Shop mo cua may gio vay?", "m-off-2")

        expect(said.resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].order-talk", "pay[r1].give-back"]))
        expect(said.reoffered.map((one) => one.error)).toEqual([null])
        // Nothing was said to the customer by the sale for it; the front desk took the line (its own run).
        expect(db.model.askedOf("chatbot.understand:agent")).toHaveLength(1)
        expect([...db.runs.keys()]).toHaveLength(2)
    })
})

const REMINDER = "Chi Lan oi, don DH-20261113-0001 (4.000 d) van cho chuyen khoan, noi dung DH-20261113-0001 a."

describe("the sale as one run: the payment wait's timeout is the reminder", () => {
    it("once the 24 h deadline of the wait falls due the customer is reminded once, and the run waits on in its next round", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        db.model.script(SP.remind, { done: { text: REMINDER } })

        db.clock.advance(24 * 60 * 60 * 1000)
        const from = db.wakes.length
        const fired = await process.deadlines?.fire({ workspaceId: WS, runId, stepKey: "pay[r1].await", repeats: 0, answered: -2 })
        expect(fired).toBe("admitted")
        const resumed = await drain(process, from)

        expect(resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].await", "pay[r1].remind"]))
        expect(saidOf(db).at(-1)).toBe(REMINDER)
        expect(db.chat.ledger.rows.at(-1)).toMatchObject({ routeId: CONV, contactId: CONTACT, text: REMINDER, state: "delivered" })
        // The order is not paid, no timer was armed for it: the reminder is the wait's own timeout.
        expect(world.books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect(world.books.timers.size).toBe(0)
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch).not.toEqual(null)
    })
})

describe("the sale as one run: the price truths price the line exactly and the order keeps the source", () => {
    const LINE = { name: "Gio hoa nho", quantity: 2, unitVnd: 1800, priceSource: { kind: "fact", id: "fact-basket" } }

    it("the consult reads the truths in force, the order line takes the truth's figure and keeps its id, and no photo goes with the summary", async () => {
        const world = await salesWorldOf(TRUTHS)
        const { db, books } = world
        // The agent writes a wrong figure on purpose: the step takes the truth's figure, never the model's.
        db.model.script(SP.consult, { done: { ...ASKED, items: [LINE] } })
        expect((await handedToConsult(world, "2 gio hoa nho"))?.error).toBeNull()
        db.model.script(SP.consult, { done: { ...READY, items: [LINE] } })
        db.model.script(SP.orderTell, { done: { text: TOLD } })
        await customerSaysToSale(world, "Dong y", "m-agree-1")

        expect(books.calls.filter((one) => one.tool === TOOL.brainFactList)).not.toHaveLength(0)
        expect(books.calls.filter((one) => one.tool === TOOL.recordList || one.tool === TOOL.fileGet)).toEqual([])
        expect(actsOf(db, TOOL.customerMessageSend)[0]?.payload).toMatchObject({ text: SUMMARY })
        expect(actsOf(db, TOOL.customerMessageSend)[0]?.payload).not.toHaveProperty("images")
        expect(books.orders.get("order-1")?.values).toMatchObject({
            items: { lines: [{ name: "Gio hoa nho", qty: 2, unitVnd: 2000, amountVnd: 4000, priceSource: { kind: "fact", id: "fact-basket" } }] },
            amountVnd: 4000,
        })
    })

    it("a NEW customer (no sale record yet: only the contact) gets the order recorded under the contact", async () => {
        const { world } = await ordered()
        expect(world.books.orders.get("order-1")?.values).toMatchObject({ contactId: CONTACT, status: "confirmed" })
        expect(world.db.team).toEqual([])
    })
})

describe("the sale as one run: a customer's cancel, on the order's status", () => {
    const CANCEL = { branch: "cancel", reply: null, items: [], address: null, recipientName: null, recipientPhone: null, deliveryAt: null, ...NONE, cancelOrderId: "order-1", cancelReason: "khong can nua" }

    /** An order the shop already recorded for the person (a sale of an earlier day), with the status the record keeps. */
    const withOrder = async (status: string) => {
        const world = await salesWorldOf(TRUTHS)
        world.books.orders.set("order-1", {
            id: "order-1",
            version: 1,
            createdAt: "2026-11-12T09:00:00.000Z",
            updatedAt: "2026-11-12T09:00:00.000Z",
            values: { contactId: CONTACT, orderNo: "DH-20261113-0001", amountVnd: 4000, status },
        })
        return world
    }

    it("an unpaid order is cancelled with no approval and the customer is told", async () => {
        const world = await withOrder("confirmed")
        const { db, books } = world
        db.model.script(SP.consult, { done: CANCEL })
        db.model.script(SP.cancelTell, { done: { text: "Don DH-20261113-0001 da huy a." } })

        const first = await handedToConsult(world, "Huy giup em don DH-20261113-0001")

        expect(first?.error).toBeNull()
        expect(books.orders.get("order-1")?.values.status).toBe("cancelled")
        expect(saidOf(db).at(-1)).toBe("Don DH-20261113-0001 da huy a.")
        expect(db.team).toEqual([])
    })

    it("a paid order is NOT cancelled: the team is told the code and the customer's words; the record is unchanged", async () => {
        const world = await withOrder("paid")
        const { db, books } = world
        db.model.script(SP.consult, { done: CANCEL })
        db.model.script(SP.cancelPaid, {
            done: { title: "Khach xin huy don da tra DH-20261113-0001", text: "Khach viet: Huy giup em don DH-20261113-0001" },
        })

        const first = await handedToConsult(world, "Huy giup em don DH-20261113-0001")

        expect(first?.error).toBeNull()
        expect(books.orders.get("order-1")?.values.status).toBe("paid")
        expect(books.calls.filter((one) => one.tool === TOOL.recordUpdate)).toEqual([])
        expect(toldOf(db)).toEqual(["Khach viet: Huy giup em don DH-20261113-0001"])
        expect(saidOf(db)).toEqual([])
    })
})

describe("a website order reads the price truths", () => {
    it("the team note is written from the price truths (their exact figure), never an inventory read", async () => {
        const world = await salesWorldOf(TRUTHS)
        const { db, books, process } = world
        db.model.script("sales.web-order-keep:agent", { done: { consultStage: "close", facts: { address: "25 Nguyen Hue" } } })
        db.model.script("sales.web-order-notice:agent", {
            done: { title: "Don web: goi xac nhan", text: "Khach dat 2 Gio hoa nho (2.000 d), goi 0900000000", summary: "2 Gio hoa nho" },
        })

        const wakes = await websiteSubmitted(db, {
            agentId: SALES,
            contactId: CONTACT,
            siteId: "site-1",
            inboundEventId: "web-1",
            visitorKey: "visitor:11111111-2222-4333-8444-555555555555",
            name: "Lan",
            phone: "0900000000",
            request: "2 gio hoa nho",
        })
        expect(wakes).toHaveLength(1)
        const woken = await runTurns(process, wakes)

        expect(woken.map((one) => one.error)).toEqual([null])
        // The wake names the core contact and no record of the sale: the graph's first step lists the sale's own record by `contactId`,
        // makes it, and the later steps use its id.
        expect(books.calls.filter((one) => one.tool === TOOL.recordList).map((one) => one.args.type)).toEqual(["blocks-core.sales.lead"])
        expect(books.calls.filter((one) => one.tool === TOOL.brainFactList)).not.toHaveLength(0)
        expect(books.calls.find((one) => one.tool === TOOL.recordList)?.args.where).toEqual({ op: "eq", field: "contactId", value: CONTACT })
        expect([...books.leads.values()].map((one) => one.values)).toMatchObject([
            { contactId: CONTACT, contactName: "Lan", channel: "website", need: "2 gio hoa nho", consultStage: "close" },
        ])
        expect([...books.leads.values()].map((one) => one.values.phone)).toEqual([undefined])
        expect(JSON.stringify(db.model.askedOf("sales.web-order-notice:agent").at(-1)?.request)).toContain('"num":2000')
        expect(toldOf(db)).toEqual(["Khach dat 2 Gio hoa nho (2.000 d), goi 0900000000"])
    })
})

// V28 PATHS (R45 packages). The payment loop's rounds run out: the sale ends `unpaid` WITH a team notice (order code and total), never silently.
describe("the sale as one run: the payment loop runs out of rounds", () => {
    it("every round's 24 h deadline falls due with no money: the customer is reminded each round, then the team is told the order and ends `unpaid`", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        const rounds = 6
        const posts = db.team.length
        for (let round = 1; round <= rounds; round += 1) {
            db.model.script(SP.remind, { done: { text: `${REMINDER} (${round})` } })
            db.clock.advance(24 * 60 * 60 * 1000)
            const from = db.wakes.length
            const fired = await process.deadlines?.fire({ workspaceId: WS, runId, stepKey: `pay[r${round}].await`, repeats: 0, answered: -2 })
            expect(fired).toBe("admitted")
            expect((await drain(process, from)).map((one) => one.error)).toEqual([null])
        }

        const steps = await threadStepsOf(process, runId)
        expect(steps).toEqual(expect.arrayContaining(["pay[r1].remind", `pay[r${rounds}].remind`, "pay"]))
        expect(steps.at(-1)).toBe("unpaid")
        expect(steps).not.toContain("to-after-sale")
        // The reminder is a courtesy (a refusal is a fact in its output, never a crash): while the Zalo reply window is open it reaches the person, once it has
        // closed (the person's last line is older than 48 h) the real send executor refuses it `outside_window`. Every round asked; none crashed the run.
        const reminders = db.chat.ledger.rows.filter((row) => row.text.startsWith(REMINDER))
        expect(reminders).toHaveLength(rounds)
        expect(reminders.filter((row) => row.state === "delivered")).toHaveLength(saidOf(db).filter((line) => line.startsWith(REMINDER)).length)
        expect(reminders.filter((row) => row.state === "refused").every((row) => row.reason === "outside_window")).toBe(true)
        expect(reminders[0]).toMatchObject({ state: "delivered" })
        // R47 (sale v29) then R68 (v30): a reminder that did not reach the person (refused, other than `route_held`) is never silent: each one posts ONE team
        // notice naming the order's code (now the ENGINE's, `remind` declares its ending), and the run's end adds ONE more (the loop out of rounds: code and
        // total). A delivered reminder tells nobody.
        const refused = reminders.filter((row) => row.state === "refused").length
        expect(refused).toBeGreaterThan(0)
        const posted = db.team.slice(posts)
        expect(posted).toHaveLength(refused + 1)
        expect(posted.filter((post) => post.key.includes(".remind:"))).toHaveLength(refused)
        for (const post of posted) expectEndingOf(post)
        expectEndingOf(posted.at(-1), { "Mã đơn": "DH-20261113-0001", "Tổng tiền": "4000" })
        expect(world.books.orders.get("order-1")?.values.status).toBe("confirmed")
        expect(db.records.get(AGENT_RUNS, runId)?.data).toMatchObject({ status: "done" })
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch ?? null).toBeNull()
    })
})

// V28: an answer about the order that did not reach the person (refused by the REAL send executor: the Zalo reply window is closed) is never silent: the
// step answers the typed refusal, the team is told (`team.unsent-notice`: step, order code, refusal) and the wait goes on. (Under a staff hold the refusal is
// `route_held` and nothing is told: sale-edges.)
describe("the sale as one run: the answer about the order is refused", () => {
    it("the reply window is closed: the team is told the order and the refusal, nothing reaches the person and the run waits on for the money", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        db.model.script(ORDER_TALK, { done: { topic: "about", reply: "Don cua chi la 4.000 d a." } })
        // The person's line is dated more than 48 h before now (the engine's own store of the conversation says when they last spoke).
        db.clock.advance(50 * 3_600_000)
        const said = saidOf(db).length
        const posts = db.team.length
        const from = db.wakes.length

        const wakes = await customersSay(process, [{ text: "Don cua em tong bao nhieu a?", key: "m-late-1", at: new Date(db.clock.now().getTime() - 49 * 3_600_000) }])
        const ended = await runTurns(process, wakes)
        const resumed = await drain(process, from)

        expect(ended.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([["done", "wait_took"], ["skipped", "no_waiter"]])
        expect(resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].order-talk"]))
        expect(saidOf(db)).toHaveLength(said)
        expect(db.chat.ledger.rows.at(-1)).toMatchObject({ state: "refused", reason: "outside_window" })
        expect(db.team).toHaveLength(posts + 1)
        expectEndingOf(db.team.at(-1))
        // The wait goes on: the credit that comes next pays the order.
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch).not.toEqual(null)
        const paid = await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })
        expect(paid.resumed.map((one) => one.error)).toEqual([null])
        expect(world.books.orders.get("order-1")?.values.status).toBe("paid")
    })
})

// V28/after-sale v15 (R45): a thank-you that did not reach the customer (refused by the REAL send executor, other than `route_held`) is never silent: the
// team is told (`thank-unsent-notice`, the order's code), and the care that follows goes on (`plan-delivery`, `plan-occasions`). The stage does NOT move to
// `after_sale` (nothing was said). The sale's order is paid first, then the after-sale is delivered as the sale's own hand-off is (`workflow.called`).
describe("the after-sale: the thank-you is refused", () => {
    const AFTER_SALE = "sales.after-sale:agent"
    const THANKS = "Shop da nhan tien don DH-20261113-0001, cam on chi Lan nhieu a!"

    const afterSaleOf = async (windowOpen: boolean, knownCustomer = false) => {
        const { world } = await ordered()
        const { db, books } = world
        // A returning customer: the sale already keeps a record of the person (the stage moves on it).
        if (knownCustomer)
            books.leads.set("lead-1", { id: "lead-1", version: 1, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", values: { contactId: CONTACT, contactName: "Lan", channel: "zalo", consultStage: "close" } })
        expect((await creditArrives(world, { id: PAYS.id, amountVnd: PAYS.amountVnd, content: PAYS.reference })).resumed.map((one) => one.error)).toEqual([null])
        if (!windowOpen) db.clock.advance(50 * 3_600_000)
        db.model.script(AFTER_SALE, { done: { text: THANKS } })
        // The check-in after delivery reads the order's delivery words as a day: none is named (the agent answers null), so the shipment is looked for first.
        db.model.script("sales.care-plan-delivery:agent", { done: { deliverOn: null } })
        const posts = db.team.length
        const said = saidOf(db).length
        const wakes = await calledWorkflow(db, {
            agentId: SALES,
            workflow: "after-sale",
            params: { orderId: "order-1", orderNo: "DH-20261113-0001", contactId: CONTACT },
            key: `call:sale:after-${String(windowOpen)}-${String(knownCustomer)}`,
            contactId: CONTACT,
            routeId: CONV,
        })
        const ran = await runTurns(world.process, wakes)
        return { world, ran, posts, said }
    }

    it("the reply window is closed: nothing reaches the person, the team is told the order's code, the care goes on and the stage does not move", async () => {
        const { world, ran, posts, said } = await afterSaleOf(false)
        const { db, process } = world

        expect(ran.map((one) => one.error)).toEqual([null])
        const steps = await threadStepsOf(process, ran[0]?.runId ?? "")
        expect(steps).toEqual(expect.arrayContaining(["thank", "has-record", "plan-delivery", "plan-occasions"]))
        expect(steps).not.toContain("stage")
        expect(steps.at(-1)).toBe("thanked")
        expect(saidOf(db)).toHaveLength(said)
        expect(db.chat.ledger.rows.at(-1)).toMatchObject({ state: "refused", reason: "outside_window", text: THANKS })
        expect(db.team).toHaveLength(posts + 1)
        expectEndingOf(db.team.at(-1))
    })

    it("the control: with the window open the thank-you is delivered, the stage moves, nobody is told", async () => {
        const { world, ran, posts, said } = await afterSaleOf(true, true)
        const { db, books, process } = world

        expect(ran.map((one) => one.error)).toEqual([null])
        const steps = await threadStepsOf(process, ran[0]?.runId ?? "")
        expect(steps).toEqual(expect.arrayContaining(["thank", "has-record", "stage", "plan-delivery", "plan-occasions"]))
        expect(saidOf(db).slice(said)).toEqual([THANKS])
        expect(db.team).toHaveLength(posts)
        expect(books.leads.get("lead-1")?.values.consultStage).toBe("after_sale")
    })

    // FINDING (RED ON PURPOSE, owner P1 / packages): a NEW customer (the sale keeps no record of the person: the order is recorded under the contact, see the
    // "NEW customer" world) whose thank-you was DELIVERED reaches `stage` with `leadId` null: the node fails `cannot` ("the stage step was reached with no
    // customer") and the run stops on a founder card instead of going on to the care steps. The graph has no guard for a person without a record.
    it("a NEW customer (no sale record) whose thank-you was delivered: the run goes on to the care steps, it does not stop at the stage", async () => {
        const { world, ran } = await afterSaleOf(true, false)
        const steps = await threadStepsOf(world.process, ran[0]?.runId ?? "")

        // R49 (sales.after-sale v16; v17 folds the delivered check into it): the if-step `has-record` reads the sale's record of the person
        // (`steps.thank.output.leadId`). A new customer has none (the order is kept under the contact alone), so the stage move is SKIPPED
        // (`stage` is not reached: it would stop on "reached with no customer"), the care steps go on and the run ends `thanked`.
        expect(steps).toEqual(expect.arrayContaining(["thank", "has-record", "plan-delivery", "plan-occasions"]))
        expect(steps).not.toContain("stage")
        expect(steps.at(-1)).toBe("thanked")
    })
})
