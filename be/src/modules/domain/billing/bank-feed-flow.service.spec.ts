import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentTagService } from "@modules/domain/agent-work"
import { PaymentTransactionsService } from "@modules/domain/payment-transactions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BankFeedFlowService } from "./bank-feed-flow.service"
import { BANK_FEED_FLOW } from "./billing.decorators"
import type { BankFeedFlow } from "./billing.decorators"

const CONNECTION = { connectionId: "c-1", workspaceId: "ws-1" }
const CREDIT = { amount: 5000, content: "BUI NGUYEN DINH", eventId: "sepay:95958515", fallbackBankName: "MBBank" }
const RECORDED = { id: "tx-row-1", created: true }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const transactions = mock<PaymentTransactionsService>()
    transactions.record.mockResolvedValue(RECORDED)
    const tags = mock<AgentTagService>()
    const graphs = mock<BankFeedFlow>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedFlowService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: PaymentTransactionsService, useValue: transactions },
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
            { provide: PaymentTransactionsService, useValue: mock<PaymentTransactionsService>() },
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

describe("BankFeedFlowService record", () => {
    it("records the credit as a payment.transaction record keyed by the provider transaction, in the caller's transaction", async () => {
        const { flows, tx, transactions } = await build()

        await expect(
            flows.record(tx.em, CONNECTION, {
                ...CREDIT,
                account: "0123456789",
                payer: "BUI NGUYEN DINH",
                occurredAt: "2026-10-28T02:15:00.000Z",
            }),
        ).resolves.toEqual(RECORDED)

        expect(transactions.record).toHaveBeenCalledWith(tx.em, "ws-1", {
            direction: "credit",
            amountVnd: 5000,
            reference: "BUI NGUYEN DINH",
            payer: "BUI NGUYEN DINH",
            externalRef: "sepay:95958515",
            account: "0123456789",
            connectionId: "c-1",
            occurredAt: "2026-10-28T02:15:00.000Z",
        })
    })

    it("stores no reference for an empty content and nothing for what the provider did not say", async () => {
        const { flows, tx, transactions } = await build()

        await flows.record(tx.em, CONNECTION, { ...CREDIT, content: "" })

        expect(transactions.record).toHaveBeenCalledWith(
            tx.em,
            "ws-1",
            expect.objectContaining({ reference: null, payer: null, account: null, connectionId: "c-1", occurredAt: null }),
        )
    })
})

describe("BankFeedFlowService tag", () => {
    it("tags the agent once, keyed by the connection and the provider transaction", async () => {
        const { flows, tx, tags } = await build()

        await flows.tag(tx.em, CONNECTION, "agent-1", CREDIT, RECORDED)

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
})

describe("BankFeedFlowService debit", () => {
    it("records a debit with no tag, rounding the amount", async () => {
        const { flows, tx, transactions, tags } = await build()

        await expect(
            flows.debit(tx.em, CONNECTION, { ...CREDIT, amount: 45000.4, content: "Pay supplier", direction: "debit" }),
        ).resolves.toEqual({ status: "debited" })

        expect(transactions.record).toHaveBeenCalledWith(tx.em, "ws-1", {
            direction: "debit",
            amountVnd: 45000,
            reference: "Pay supplier",
            payer: null,
            externalRef: "sepay:95958515",
            account: null,
            connectionId: "c-1",
            occurredAt: null,
        })
        expect(tags.tagAgent).not.toHaveBeenCalled()
    })

    it("stores no reference for an empty content", async () => {
        const { flows, tx, transactions } = await build()

        await flows.debit(tx.em, CONNECTION, { ...CREDIT, content: "", direction: "debit" })

        expect(transactions.record).toHaveBeenCalledWith(tx.em, "ws-1", expect.objectContaining({ reference: null }))
    })
})
