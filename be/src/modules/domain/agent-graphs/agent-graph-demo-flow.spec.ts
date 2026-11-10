import { TOOL } from "@nivo-lite/blocks-core"
import {
    ACCOUNTING,
    CHATBOT,
    CONSULT_PATH,
    CONVERSATION,
    ANSWER_PURPOSE,
    MATCH_PURPOSE,
    ORDER_NO,
    QR_URL,
    SALES_OWNER,
    SETTLE_PURPOSE,
    TRANSFER_CODE,
    UNDERSTAND_PURPOSE,
    agrees,
    answers,
    baseStore,
    catalogueRow,
    closingShop,
    confusedBy,
    creditWake,
    customerSays,
    effectsSince,
    lastSent,
    leadOf,
    matches,
    paysOrder,
    play,
    rowsOf,
    shopOf,
    tagWake,
    thanks,
    understands,
    workflowOf,
} from "@tests/fixtures/builders/demo-flow-shop.builder"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { handOffWake, teamLineOf } from "@tests/fixtures/builders/flow-f-world.builder"
import { outcomeIn } from "@tests/fixtures/builders/lead-memory-world.builder"
import {
    CONSULT_PURPOSE,
    CREATE_ORDER_PURPOSE,
    SEND_QR_PURPOSE,
    consultAsks,
    createsOrder,
    sendsQr,
} from "@tests/fixtures/builders/sales-flow-cases.builder"
import type { Shop } from "@tests/fixtures/builders/demo-flow-shop.builder"
import words from "@tests/fixtures/builders/demo-flow-shop.words.json"

// The main demo flow end to end on the seeded chatbot, sales and accounting graphs: the real node steps over the in-memory world, every
// acting step an agent whose turns (tool calls, then its output) are scripted, a fake channel that captures every send, and the real
// `agent.tag` door. It never touches Zalo, Telegram or a bank.

/** The one shop the story of a customer from the first word to the thanks runs against, stage after stage. */
const story = shopOf({ ...baseStore(), "sales-lead": [{ id: "lead-1", contactName: words.customerName }] })

/** One turn of the consult that asks the customer the next question. */
const asks = (text: string, catalogueItemIds?: ReadonlyArray<string>) => ({
    [CONSULT_PURPOSE]: [
        ...consultAsks({
            conversationId: CONVERSATION,
            text,
            leadId: "lead-1",
            ...(catalogueItemIds === undefined ? {} : { catalogueItemIds }),
        }),
    ],
})

/** What the team was told in the team chat, in order: the summary of each line the shop's agents and the engine posted. */
const teamTold = (shop: Shop, from = 0): ReadonlyArray<string> =>
    shop.world.ran
        .slice(from)
        .filter((each) => each.effect === TOOL.teamMessagePost)
        .map((each) => teamLineOf(each.payload))

describe("the main demo flow, stage 1: the front desk hands a buying customer to Sales", () => {
    it("understands a buying wish and hands over to the Sales agent that owns the Zalo channel, saying nothing itself", async () => {
        const turn = await customerSays(story, words.wantFlowers, {
            front: understands("buy"),
            sales: asks(words.askWho),
        })

        expect(turn.front).toMatchObject({ failed: null, error: null })
        expect(turn.front.path).toEqual(["understand", "to-consult"])
        expect(story.tagged).toMatchObject([
            {
                fromAgentId: CHATBOT,
                toAgentId: SALES_OWNER,
                leadId: "lead-1",
                conversationId: CONVERSATION,
                channel: "zalo",
            },
        ])
        // The front desk never speaks to a customer who wants to buy: Sales takes the conversation.
        expect(story.sent.filter((each) => each.agent === CHATBOT)).toEqual([])
        expect(turn.sales).toMatchObject({ failed: null, error: null })
        expect(turn.sales?.path).toEqual(CONSULT_PATH)
        expect(story.sent).toMatchObject([
            { agent: SALES_OWNER, payload: { conversationId: CONVERSATION, text: words.askWho } },
        ])
        // Routing went through the agents' workflows: the customer line took the front desk's Zalo trigger, and the hand-off's pin
        // (workflow + version, with ONLY the mapped params and the calling run) took the Sales consult.
        expect(workflowOf(story, turn.front)).toBe("front-desk")
        expect(workflowOf(story, turn.sales)).toBe("consult")
        expect(story.tagged[0]?.context).toMatchObject({
            workflowCall: { workflow: "consult", version: "latest" },
            params: { leadId: "lead-1", conversationId: CONVERSATION, text: words.wantFlowers, channel: "zalo" },
            caller: { runId: turn.front.runId },
        })
        expect(turn.sales?.outputs.consult?.output).toMatchObject({ branch: "asked", leadId: "lead-1" })
    })
})

describe("the main demo flow, stage 2: the consult", () => {
    it("asks one question a turn, and an open consult keeps the conversation: the front desk starts no run", async () => {
        const who = await customerSays(story, words.forMother, { front: {}, sales: asks(words.askBudget) })
        // The consult holds the conversation (an engine rule, `entry.holdsConversation`): the front door starts no run, so its AI
        // never reads the line, and the line is written again as the Sales agent's own customer wake.
        expect(who.front).toMatchObject({ path: [], runId: null, held: false, skipped: "conversation_held" })
        expect(story.holds.redirected).toMatchObject([{ agentId: SALES_OWNER, source: "customer" }])
        expect(outcomeIn(story.memory, "sales.consult", "consult")?.output).toMatchObject({ branch: "asked" })
        expect(workflowOf(story, who.sales)).toBe("consult")
        expect(who.effects).toEqual([TOOL.customerMessageSend])
        expect(lastSent(story)?.payload.text).toBe(words.askBudget)

        const budget = await customerSays(story, words.budgetSaid, { front: {}, sales: asks(words.askTime) })
        expect(budget.sales?.path).toEqual(CONSULT_PATH)
        expect(lastSent(story)?.payload.text).toBe(words.askTime)
        expect(lastSent(story)?.payload).not.toHaveProperty("catalogueItemIds")
    })

    it("recommends the products that fit with their photos in one send, naming catalogue items by id and no price", async () => {
        const picks = ["c1", "c2", "c3"]
        const turn = await customerSays(story, words.timeSaid, { front: {}, sales: asks(words.recommend, picks) })

        expect(turn.sales).toMatchObject({ failed: null, error: null })
        expect(lastSent(story)).toMatchObject({
            agent: SALES_OWNER,
            payload: { conversationId: CONVERSATION, text: words.recommend, catalogueItemIds: picks },
        })
        expect(rowsOf(story.store, "order")).toEqual([])
    })
})

describe("the main demo flow, stage 3: the order and the payment request", () => {
    it("records the order once the customer settles the item and the address, confirms it under the owner's limit, sends its QR and tells the team", async () => {
        const before = story.sent.length
        const ranBefore = story.world.ran.length
        const turn = await customerSays(story, words.pickSaid, { front: {}, sales: agrees() })

        expect(turn.sales).toMatchObject({ failed: null, error: null, waited: null })
        expect(turn.sales?.path).toEqual(["consult", "create-order", "send-qr", "notify-order", "won"])
        expect(turn.effects).toEqual([TOOL.orderRecord, TOOL.orderConfirm, TOOL.paymentQrCreate, TOOL.teamMessagePost])
        // The agent typed the catalogue item and the quantity; the price, the total and the order number are the order tool's.
        expect(story.world.ran[ranBefore]?.payload).toEqual({
            leadId: "lead-1",
            items: [{ catalogueItemId: "c1", qty: 1 }],
            address: words.addressFact,
        })
        expect(rowsOf(story.store, "order")).toMatchObject([
            { id: "order-1", orderNo: ORDER_NO, leadId: "lead-1", amountVnd: 450_000, status: "confirmed" },
        ])
        // The QR goes out by the order's id alone: its transfer content and picture are the QR tool's.
        const payment = story.sent.slice(before)
        expect(payment).toMatchObject([
            {
                effect: TOOL.paymentQrCreate,
                agent: SALES_OWNER,
                payload: { orderId: "order-1", text: TRANSFER_CODE, qrUrl: QR_URL },
            },
        ])
        expect(story.world.ran.at(-1)?.payload).toEqual({ kind: "order.summary", orderId: "order-1" })
        expect(turn.sales?.outputs.won?.output).toMatchObject({ outcome: "won", values: { orderId: "order-1" } })
    })

    it("keeps what the customer settled in the lead's memory, for the workflows that follow", async () => {
        const subject = { key: "lead:lead-1", leadId: "lead-1", conversationId: CONVERSATION }
        const memory = await story.memory.service.snapshot("ws-1", subject, "step")

        expect(memory?.lead).toMatchObject({
            address: words.addressFact,
            lastOrderId: "order-1",
            lastOrderCode: ORDER_NO,
        })
    })
})

describe("the main demo flow, stage 4: the payment arrives and the customer is cared for", () => {
    it("matches the SePay credit to the order, marks it paid with the two ids, posts it, tells the team and calls Sales' after-sale", async () => {
        rowsOf(story.store, "bank-transaction").push({
            id: "tx-sepay-1",
            amountVnd: 450_000,
            reference: `${TRANSFER_CODE} NGUYEN VAN A chuyen khoan`,
            payer: "NGUYEN VAN A",
            occurredAt: "2026-11-04T10:05:00.000Z",
            orderId: null,
            status: "new",
        })
        const sentBefore = story.sent.length
        const taggedBefore = story.tagged.length
        const ranBefore = story.world.ran.length
        const seat = { id: ACCOUNTING, module: "accounting" } as const

        const credit = await play(story, seat, creditWake("tx-sepay-1"), paysOrder("tx-sepay-1", "order-1"))

        expect(credit).toMatchObject({ failed: null, error: null })
        // The SePay credit is routed to the reconcile workflow by its trigger (source sepay), and the trigger carries the transaction.
        expect(credit.path).toEqual(["match", "mark-paid", "ledger", "notify-paid", "to-after-sale"])
        expect(workflowOf(story, credit)).toBe("reconcile")
        // The agent named the two ids; the numbers and the verdict are read back from the records.
        expect(credit.outputs.match?.output).toMatchObject({
            branch: "matched",
            orderId: "order-1",
            leadId: "lead-1",
            verdict: "exact",
            expectedVnd: 450_000,
            receivedVnd: 450_000,
        })
        expect(story.world.ran[ranBefore]).toMatchObject({
            effect: TOOL.paymentMarkPaid,
            payload: { orderId: "order-1", transactionId: "tx-sepay-1" },
        })
        expect(rowsOf(story.store, "order")[0]).toMatchObject({ id: "order-1", status: "paid" })
        expect(rowsOf(story.store, "bank-transaction")[0]).toMatchObject({ orderId: "order-1", status: "matched" })
        expect(story.toolCalls.map((call) => [call.tool, call.args])).toEqual([
            [TOOL.ledgerAppend, { transactionId: "tx-sepay-1" }],
        ])
        // Accounting says nothing to the customer: Sales thanks them in its after-sale workflow, which the paid order is handed to.
        expect(story.sent.slice(sentBefore)).toEqual([])
        const tags = story.tagged.slice(taggedBefore)
        const context = {
            workflowCall: { workflow: "after-sale", version: "latest" },
            params: { orderId: "order-1", leadId: "lead-1" },
            caller: { runId: credit.runId },
        }
        expect(tags).toMatchObject([{ fromAgentId: ACCOUNTING, toAgentId: SALES_OWNER, leadId: "lead-1", context }])
        // The tag names no conversation, so it never waits in the conversation's right-to-speak queue.
        expect(tags[0]?.conversationId).toBeUndefined()
    })

    it("thanks the customer in the after-sale workflow, arms the delivery check and moves the customer to after-sale", async () => {
        const paidTag = story.tagged.at(-1)
        const seat = { id: paidTag?.toAgentId ?? "", module: "sales" } as const
        const thanked = await play(story, seat, tagWake(paidTag), thanks("order-1", words.thanksLine))

        expect(thanked).toMatchObject({ failed: null, error: null })
        expect(thanked.path).toEqual(["thank", "plan", "thanked"])
        expect(workflowOf(story, thanked)).toBe("after-sale")
        expect(lastSent(story)).toMatchObject({
            effect: TOOL.customerMessageSend,
            agent: SALES_OWNER,
            payload: { leadId: "lead-1", text: words.thanksLine },
        })
        expect(thanked.outputs.thank?.output).toMatchObject({ orderId: "order-1", sent: true })
        const armed = story.world.ran.filter((each) => each.effect === TOOL.careSchedule).map((each) => each.payload)
        expect(armed.at(-1)).toMatchObject({ kind: "delivery-check", ref: "order-1" })
        expect(leadOf(story)).toMatchObject({ consultStage: "after_sale" })
    })

    it("sent the customer the consult, the QR and the thanks, all from Sales, nothing from the front desk or Accounting", () => {
        expect(story.sent.map((each) => each.agent)).toEqual(story.sent.map(() => SALES_OWNER))
        expect(story.sent.map((each) => each.effect)).toEqual([
            TOOL.customerMessageSend,
            TOOL.customerMessageSend,
            TOOL.customerMessageSend,
            TOOL.customerMessageSend,
            TOOL.paymentQrCreate,
            TOOL.customerMessageSend,
        ])
        expect(rowsOf(story.store, "order")).toHaveLength(1)
        // Nothing stopped: no step asked the founder for anything.
        expect(rowsOf(story.store, "work-item")).toEqual([])
        expect(teamTold(story)).toEqual(["order.summary", "payment.received"])
    })

    it("answers the customer's next line at the front desk again: the consult let the conversation go on its outcome", async () => {
        const turn = await customerSays(story, words.hoursQuestion, {
            front: { ...understands("question"), ...answers(words.hoursAnswer) },
        })

        expect(turn.front).toMatchObject({ failed: null, skipped: null })
        expect(turn.front.path).toEqual(["understand", "answer"])
        expect(turn.sales).toBeNull()
        expect(lastSent(story)).toMatchObject({ agent: CHATBOT, payload: { text: words.hoursAnswer } })
    })
})

describe("the main demo flow: a question at the front desk", () => {
    const shopWithDocuments = (): Shop =>
        shopOf({
            ...baseStore(),
            "knowledge-document": [{ id: "d1", title: words.docTitle, body: words.docBody, visibility: "public" }],
        })

    it("answers a question the shop's public documents answer, with one send, and the turn ends there", async () => {
        const shop = shopWithDocuments()
        const turn = await customerSays(shop, words.hoursQuestion, {
            front: { ...understands("question"), ...answers(words.hoursAnswer) },
        })

        expect(turn.front).toMatchObject({ failed: null, error: null })
        expect(turn.front.path).toEqual(["understand", "answer"])
        expect(turn.effects).toEqual([TOOL.customerMessageSend])
        expect(shop.sent).toMatchObject([
            { agent: CHATBOT, payload: { conversationId: CONVERSATION, text: words.hoursAnswer } },
        ])
        expect(shop.tagged).toEqual([])
    })

    it("sends the customer nothing made up when the documents do not answer: the agent says so, the step stops and the team is told once", async () => {
        const shop = shopWithDocuments()
        const turn = await customerSays(shop, words.abroadQuestion, {
            front: {
                ...understands("question"),
                [ANSWER_PURPOSE]: [confusedBy(words.abroadReason, words.abroadAsk)],
            },
        })

        expect(turn.front).toMatchObject({ failed: "answer", path: ["understand"] })
        // No AI core is bound in this shop: the engine speaks for itself, with the facts, in the team chat only.
        expect(shop.sent).toEqual([])
        expect(turn.effects).toEqual([TOOL.teamMessagePost])
        expect(teamTold(shop)).toHaveLength(1)
        expect(teamTold(shop)[0]).toContain("ai_confused")
        expect(teamTold(shop)[0]).toContain(words.abroadReason)
        expect(teamTold(shop)[0]).toContain(words.abroadAsk)
    })

    it("guesses no route when the front desk cannot tell what the customer wants: nothing is sent and nobody is called", async () => {
        const shop = shopWithDocuments()
        const turn = await customerSays(shop, words.stillWaiting, {
            front: { [UNDERSTAND_PURPOSE]: [confusedBy(words.abroadReason)] },
        })

        expect(turn.front).toMatchObject({ failed: "understand", path: [] })
        expect(shop.sent).toEqual([])
        expect(shop.tagged).toEqual([])
        expect(turn.effects).toEqual([TOOL.teamMessagePost])
    })
})

describe("the main demo flow: when the QR cannot be made", () => {
    it("keeps the confirmed order, sends the customer no payment detail it does not have, and tells the team where it stopped", async () => {
        const shop = closingShop()
        shop.missing.add(TOOL.paymentQrCreate)
        const sales = {
            ...agrees(),
            // The QR call comes back as a refusal (a fact); the agent cannot finish the step and says so.
            [SEND_QR_PURPOSE]: [...sendsQr("order-1").slice(0, 1), confusedBy(words.qrReason, words.qrAsk)],
        }
        const turn = await customerSays(shop, words.agreeSaid, { front: {}, sales })

        expect(turn.sales).toMatchObject({ failed: "send-qr", path: ["consult", "create-order"] })
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "confirmed", amountVnd: 450_000 })
        // No QR, no bank details, no payment code: nothing reached the customer.
        expect(shop.sent).toEqual([])
        expect(effectsSince(shop, 0)).toEqual([TOOL.orderRecord, TOOL.orderConfirm, TOOL.teamMessagePost])
        expect(teamTold(shop)[0]).toContain("send-qr (payment.request)")
        expect(teamTold(shop)[0]).toContain(words.qrReason)
    })
})

describe("the main demo flow: an order over the owner's limit", () => {
    const overLimit = (): Shop => {
        const shop = closingShop()
        shop.store["catalogue-item"] = [catalogueRow("c1", words.roseName, 6_000_000)]
        return shop
    }

    /** The Sales turn of an order the order tool will not confirm yet: the agent reads the refusal, says one holding line and asks the founder. */
    const waitsOwner = () => ({
        ...agrees(),
        [CREATE_ORDER_PURPOSE]: [
            ...createsOrder({
                leadId: "lead-1",
                items: [{ catalogueItemId: "c1", quantity: 1 }],
                address: words.addressFact,
                orderId: "order-1",
                orderNo: ORDER_NO,
            }).slice(0, 2),
            {
                call: {
                    tool: TOOL.customerMessageSend,
                    args: { conversationId: CONVERSATION, text: words.limitHolding },
                },
            },
            confusedBy(words.limitReason, words.limitAsk),
        ],
    })

    it("leaves an order over the owner's limit to the owner: the order tool refuses to confirm it, the step stops there with no payment request", async () => {
        const shop = overLimit()
        const turn = await customerSays(shop, words.agreeSaid, { front: {}, sales: waitsOwner() })

        expect(turn.sales).toMatchObject({ failed: "create-order", path: ["consult"] })
        // The rule is the tool's: the agent asked to confirm and got the refusal as a fact, the order stays a draft.
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "draft", amountVnd: 6_000_000 })
        expect(effectsSince(shop, 0)).toEqual([TOOL.orderRecord, TOOL.customerMessageSend, TOOL.teamMessagePost])
        // The customer hears one holding line, the agent's own choice, and never a confirmation or a QR.
        expect(shop.sent).toMatchObject([{ agent: SALES_OWNER, payload: { text: words.limitHolding } }])
        expect(teamTold(shop)[0]).toContain(words.limitReason)
        expect(teamTold(shop)[0]).toContain(words.limitAsk)
    })

    it("opens no second consult run for the same lead and the same hand-off while the first still waits on the owner", async () => {
        const shop = overLimit()
        const seat = { id: SALES_OWNER, module: "sales" } as const
        const call = (caller: string) => {
            shop.runViews.set(caller, runViewOf({ id: caller, agentId: CHATBOT, status: "done" }))
            const params = { leadId: "lead-1", conversationId: CONVERSATION, text: words.agreeSaid, channel: "zalo" }
            return handOffWake({ workflow: "consult" }, params, words.agreeSaid, caller)
        }
        const first = await play(shop, seat, call("run-front-1"), waitsOwner())
        const runsBefore = shop.runs.length

        const replay = await play(shop, seat, call("run-front-2"), waitsOwner())

        expect(first).toMatchObject({ failed: "create-order" })
        // The engine's guard refuses the call (the same workflow, lead and params stand), before any step is written.
        expect(replay).toMatchObject({ held: false, runId: null, path: [], skipped: "call_duplicate" })
        expect(shop.runs).toHaveLength(runsBefore)
        expect(rowsOf(shop.store, "order")).toHaveLength(1)
    })
})

describe("the main demo flow: a transfer that does not match its order", () => {
    const confirmedShop = (transferVnd: number): Shop =>
        shopOf({
            ...baseStore(),
            "sales-lead": [{ id: "lead-1", contactName: words.customerName }],
            order: [
                {
                    id: "order-1",
                    orderNo: ORDER_NO,
                    leadId: "lead-1",
                    items: { lines: [] },
                    amountVnd: 450_000,
                    status: "confirmed",
                    confirmedAt: "2026-11-04T10:00:30.000Z",
                    createdAt: "2026-11-04T10:00:00.000Z",
                },
            ],
            "bank-transaction": [
                {
                    id: "tx-short",
                    amountVnd: transferVnd,
                    reference: `${TRANSFER_CODE} chuyen khoan`,
                    payer: "NGUYEN VAN A",
                    occurredAt: "2026-11-04T10:05:00.000Z",
                    orderId: null,
                    status: "new",
                },
            ],
        })
    const seat = { id: ACCOUNTING, module: "accounting" } as const

    it("marks nothing paid and tells the customer nothing when the agent, seeing a transfer 2.000 dong short, asks the founder instead of settling", async () => {
        const shop = confirmedShop(448_000)
        const model = {
            ...matches("tx-short", "order-1"),
            [SETTLE_PURPOSE]: [confusedBy(words.shortReason, words.shortAsk)],
        }
        const played = await play(shop, seat, creditWake("tx-short"), model)

        expect(played).toMatchObject({ failed: "mark-paid", path: ["match"] })
        // The match judged nothing for its amount: it names the order, and the numbers are read back from the records.
        expect(played.outputs.match?.output).toMatchObject({
            branch: "matched",
            verdict: "short",
            expectedVnd: 450_000,
            receivedVnd: 448_000,
        })
        // No code decides for a short payment: the agent chose to ask, so nothing was settled.
        expect(effectsSince(shop, 0)).toEqual([TOOL.teamMessagePost])
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "confirmed" })
        expect(rowsOf(shop.store, "bank-transaction")[0]).toMatchObject({ orderId: null, status: "new" })
        expect(shop.sent).toEqual([])
        expect(shop.tagged).toEqual([])
        expect(teamTold(shop)[0]).toContain("mark-paid (payment.settle)")
        expect(teamTold(shop)[0]).toContain(words.shortReason)
    })

    it("does not refuse a short transfer in the tool: when the agent settles it, the order is paid and the true numbers are the tool's answer", async () => {
        const shop = confirmedShop(448_000)
        const played = await play(shop, seat, creditWake("tx-short"), paysOrder("tx-short", "order-1"))

        expect(played).toMatchObject({ failed: null, error: null })
        expect(played.path.slice(0, 2)).toEqual(["match", "mark-paid"])
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "paid" })
        expect(rowsOf(shop.store, "bank-transaction")[0]).toMatchObject({ orderId: "order-1", status: "matched" })
    })

    it("stops at the match and marks nothing paid when the agent cannot tell which order a credit pays", async () => {
        const shop = confirmedShop(99_000)
        const model = { [MATCH_PURPOSE]: [confusedBy(words.shortReason, words.shortAsk)] }
        const played = await play(shop, seat, creditWake("tx-short"), model)

        expect(played).toMatchObject({ failed: "match", path: [] })
        expect(effectsSince(shop, 0)).toEqual([TOOL.teamMessagePost])
        expect(teamTold(shop)[0]).toContain("bank-transaction:tx-short")
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "confirmed" })
    })

    it("settles the same order when the transfer is exact", async () => {
        const shop = confirmedShop(450_000)
        const played = await play(shop, seat, creditWake("tx-short"), paysOrder("tx-short", "order-1"))

        expect(played).toMatchObject({ failed: null, error: null })
        expect(played.path.slice(0, 2)).toEqual(["match", "mark-paid"])
        expect(played.outputs["mark-paid"]?.output).toMatchObject({
            result: "paid",
            orderId: "order-1",
            leadId: "lead-1",
        })
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "paid" })
        expect(rowsOf(shop.store, "bank-transaction")[0]).toMatchObject({ orderId: "order-1", status: "matched" })
        expect(rowsOf(shop.store, "work-item")).toEqual([])
    })
})
