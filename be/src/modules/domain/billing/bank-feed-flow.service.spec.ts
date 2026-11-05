import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { transactionOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { AgentTagService } from "@modules/domain/agent-work"
import { TransactionsService } from "@modules/domain/transactions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BankFeedFlowService } from "./bank-feed-flow.service"
import { BANK_FEED_FLOW } from "./billing.decorators"
import type { BankFeedFlow } from "./billing.decorators"

const CONNECTION = { connectionId: "c-1", workspaceId: "ws-1" }
const CREDIT = { amount: 5000, content: "BUI NGUYEN DINH", eventId: "sepay:95958515", fallbackBankName: "MBBank" }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const transactions = mock<TransactionsService>()
    transactions.open.mockResolvedValue(transactionOf({ id: "tx-row-1" }))
    const tags = mock<AgentTagService>()
    const graphs = mock<BankFeedFlow>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedFlowService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: TransactionsService, useValue: transactions },
            { provide: AgentTagService, useValue: tags },
            { provide: BANK_FEED_FLOW, useValue: graphs },
        ],
    }).compile()
    return { flows: moduleRef.get(BankFeedFlowService), tx, transactions, tags, graphs }
}

/** A flow that has no port bound by the app. */
const buildUnbound = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedFlowService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: TransactionsService, useValue: mock<TransactionsService>() },
            { provide: AgentTagService, useValue: mock<AgentTagService>() },
        ],
    }).compile()
    return moduleRef.get(BankFeedFlowService)
}

describe("BankFeedFlowService owns", () => {
    it.each([true, false])("answers %s when the live version of the agent has a flow answering so", async (live) => {
        const { flows, graphs } = await build()
        graphs.hasLiveFlow.mockResolvedValue(live)

        await expect(flows.owns("ws-1", "agent-1")).resolves.toBe(live)
        expect(graphs.hasLiveFlow).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("answers false when the app binds no flow port", async () => {
        await expect((await buildUnbound()).owns("ws-1", "agent-1")).resolves.toBe(false)
    })
})

describe("BankFeedFlowService tag", () => {
    it("records the transaction and tags the agent once, keyed by the connection and the provider transaction", async () => {
        const { flows, tx, transactions, tags } = await build()

        await flows.tag(tx.em, CONNECTION, "agent-1", CREDIT, "event-1")

        expect(transactions.open).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                inboundEventId: "event-1",
                amountVnd: 5000,
                reference: "BUI NGUYEN DINH",
                payer: null,
            },
            tx.em,
        )
        expect(tags.tagAgent).toHaveBeenCalledWith(
            {
                source: "bank_feed",
                workspaceId: "ws-1",
                toAgentId: "agent-1",
                text: 'vi:billing.bankFeedTag:{"amount":5000,"content":"BUI NGUYEN DINH"}',
                subject: "bank-transaction:tx-row-1",
                eventKey: "bank-feed:c-1:sepay:95958515",
            },
            tx.em,
        )
    })

    it("stores no reference for an empty content", async () => {
        const { flows, tx, transactions } = await build()

        await flows.tag(tx.em, CONNECTION, "agent-1", { ...CREDIT, content: "" }, "event-1")

        expect(transactions.open).toHaveBeenCalledWith(expect.objectContaining({ reference: null }), tx.em)
    })
})

describe("BankFeedFlowService debit", () => {
    it("records a debit transaction with no inbound event, rounding the amount", async () => {
        const { flows, tx, transactions, tags } = await build()

        await expect(
            flows.debit(tx.em, CONNECTION, { ...CREDIT, amount: 45000.4, content: "Pay supplier", direction: "debit" }),
        ).resolves.toEqual({ status: "debited" })

        expect(transactions.open).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                inboundEventId: null,
                amountVnd: 45000,
                reference: "Pay supplier",
                payer: null,
                direction: "debit",
            },
            tx.em,
        )
        expect(tags.tagAgent).not.toHaveBeenCalled()
    })

    it("stores no reference for an empty content", async () => {
        const { flows, tx, transactions } = await build()

        await flows.debit(tx.em, CONNECTION, { ...CREDIT, content: "", direction: "debit" })

        expect(transactions.open).toHaveBeenCalledWith(expect.objectContaining({ reference: null }), tx.em)
    })
})
