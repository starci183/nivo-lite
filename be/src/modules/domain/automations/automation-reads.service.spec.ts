import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsAutomationReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesAutomationReadService } from "@modules/domain/agent-messages"
import { ContractsReadService } from "@modules/domain/contracts"
import { EventsActivityReadService } from "@modules/domain/events"
import { InvoicesAutomationReadService } from "@modules/domain/invoices"
import { LeadAutomationReadService } from "@modules/domain/leads"
import { OrdersAutomationReadService } from "@modules/domain/orders"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AutomationReadsService } from "./automation-reads.service"

const build = async () => {
    const transaction = fakeTransaction(mockEntityManager())
    const leads = mock<LeadAutomationReadService>()
    const conversations = mock<AgentConversationsAutomationReadService>()
    const messages = mock<AgentMessagesAutomationReadService>()
    const events = mock<EventsActivityReadService>()
    const orders = mock<OrdersAutomationReadService>()
    const invoices = mock<InvoicesAutomationReadService>()
    const contracts = mock<ContractsReadService>()
    const work = mock<WorkItemsActivityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationReadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: transaction.em },
            { provide: LeadAutomationReadService, useValue: leads },
            { provide: AgentConversationsAutomationReadService, useValue: conversations },
            { provide: AgentMessagesAutomationReadService, useValue: messages },
            { provide: EventsActivityReadService, useValue: events },
            { provide: OrdersAutomationReadService, useValue: orders },
            { provide: InvoicesAutomationReadService, useValue: invoices },
            { provide: ContractsReadService, useValue: contracts },
            { provide: WorkItemsActivityService, useValue: work },
        ],
    }).compile()
    return {
        reads: moduleRef.get(AutomationReadsService),
        transaction,
        leads,
        conversations,
        messages,
        events,
        orders,
        invoices,
        contracts,
        work,
    }
}

describe("AutomationReadsService lead and conversation reads", () => {
    it("reads one lead from the leads owner", async () => {
        const { reads, leads } = await build()
        leads.lead.mockResolvedValue(undefined)

        await expect(reads.lead("ws-1", "lead-1")).resolves.toBeUndefined()

        expect(leads.lead).toHaveBeenCalledWith("ws-1", "lead-1")
    })

    it("reads one conversation and the latest conversation of a lead from the conversations owner", async () => {
        const { reads, conversations } = await build()
        conversations.conversation.mockResolvedValue(undefined)
        conversations.latestOfLead.mockResolvedValue(undefined)

        await expect(reads.conversation("ws-1", "conv-1")).resolves.toBeUndefined()
        await expect(reads.latestConversation("ws-1", "lead-1")).resolves.toBeUndefined()

        expect(conversations.conversation).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(conversations.latestOfLead).toHaveBeenCalledWith("ws-1", "lead-1")
    })

    it("scans the leads and finds the ones that have a chat", async () => {
        const { reads, leads, conversations } = await build()
        const scanned: Awaited<ReturnType<AutomationReadsService["scanLeads"]>> = []
        const chatting: Awaited<ReturnType<AutomationReadsService["leadsWithChat"]>> = []
        leads.scanLeads.mockResolvedValue(scanned)
        conversations.leadsWithChat.mockResolvedValue(chatting)
        const query = { workspaceId: "ws-1", since: "2026-10-01T00:00:00.000Z", stages: null, except: null, limit: 10 }

        await expect(reads.scanLeads(query)).resolves.toBe(scanned)
        await expect(reads.leadsWithChat("ws-1", ["lead-1"])).resolves.toBe(chatting)

        expect(leads.scanLeads).toHaveBeenCalledWith(query)
        expect(conversations.leadsWithChat).toHaveBeenCalledWith("ws-1", ["lead-1"])
    })

    it("reads when the customer last wrote in a conversation", async () => {
        const { reads, messages } = await build()
        messages.lastCustomerMessage.mockResolvedValue(undefined)

        await expect(reads.lastCustomerMessage("conv-1")).resolves.toBeUndefined()

        expect(messages.lastCustomerMessage).toHaveBeenCalledWith("conv-1")
    })
})

describe("AutomationReadsService money and contract reads", () => {
    it("reads the last activity of leads with the bound of the scan", async () => {
        const { reads, events } = await build()
        const activity: Awaited<ReturnType<EventsActivityReadService["lastAtByLead"]>> = []
        events.lastAtByLead.mockResolvedValue(activity)

        await expect(reads.leadActivity("ws-1", ["lead-1"])).resolves.toBe(activity)

        expect(events.lastAtByLead).toHaveBeenCalledWith("ws-1", ["lead-1"], 500)
    })

    it("reads the issued invoices due before an instant and one order", async () => {
        const { reads, invoices, orders } = await build()
        const debts: Awaited<ReturnType<AutomationReadsService["debtInvoices"]>> = []
        invoices.debtInvoices.mockResolvedValue(debts)
        orders.order.mockResolvedValue(undefined)

        await expect(reads.debtInvoices("ws-1", "2026-10-01")).resolves.toBe(debts)
        await expect(reads.order("ws-1", "order-1")).resolves.toBeUndefined()

        expect(invoices.debtInvoices).toHaveBeenCalledWith("ws-1", "2026-10-01")
        expect(orders.order).toHaveBeenCalledWith("ws-1", "order-1")
    })

    it("reads one contract and the contracts ending between two days with the bound of the scan", async () => {
        const { reads, contracts } = await build()
        const ending: Awaited<ReturnType<AutomationReadsService["expiringContracts"]>> = []
        contracts.contractById.mockResolvedValue(undefined)
        contracts.activeEndingBetween.mockResolvedValue(ending)

        await expect(reads.contract("ws-1", "contract-1")).resolves.toBeUndefined()
        await expect(reads.expiringContracts("ws-1", "2026-11-01", "2026-11-30")).resolves.toBe(ending)

        expect(contracts.contractById).toHaveBeenCalledWith("ws-1", "contract-1")
        expect(contracts.activeEndingBetween).toHaveBeenCalledWith("ws-1", "2026-11-01", "2026-11-30", 100)
    })
})

describe("AutomationReadsService dayFigures", () => {
    it("reads the figures of the day in one repeatable-read snapshot", async () => {
        const { reads, transaction, leads, orders, invoices, events, work } = await build()
        leads.countCreatedSince.mockResolvedValue(3)
        orders.confirmedSince.mockResolvedValue({ count: 2, total: "900000" })
        invoices.paidTotalSince.mockResolvedValue(500000)
        events.leadIdsOfKindSince.mockResolvedValue(["lead-1", "lead-2"])
        leads.countWonAmong.mockResolvedValue(1)
        work.waitingSummaries.mockResolvedValue(["Send quote", null])

        await expect(reads.dayFigures("ws-1", "2026-10-30T00:00:00.000Z")).resolves.toEqual({
            new_leads: 3,
            confirmed_orders: 2,
            confirmed_total: "900000",
            money_in: 500000,
            won_leads: 1,
            waiting: ["Send quote", null],
        })

        expect(transaction.em.transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function))
        expect(leads.countCreatedSince).toHaveBeenCalledWith("ws-1", "2026-10-30T00:00:00.000Z", expect.anything())
        expect(events.leadIdsOfKindSince).toHaveBeenCalledWith(
            "ws-1",
            "outcome.recorded",
            new Date("2026-10-30T00:00:00.000Z"),
            500,
        )
        expect(leads.countWonAmong).toHaveBeenCalledWith("ws-1", ["lead-1", "lead-2"], expect.anything())
        expect(work.waitingSummaries).toHaveBeenCalledWith("ws-1", 50, expect.anything())
    })
})
