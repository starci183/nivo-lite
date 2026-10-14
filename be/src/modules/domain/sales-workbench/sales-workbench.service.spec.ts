import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ContractsService } from "@modules/domain/contracts"
import { EvidenceService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { ExecutionsService } from "@modules/domain/executions"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadView } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import * as mapper from "./sales-workbench.mapper"
import { SalesWorkbenchService } from "./sales-workbench.service"

const NOW = "2026-10-13T02:00:00.000Z"

const leadOf = builder<LeadView>({
    id: "lead-1",
    contact_name: "Mai",
    company: "Company",
    channel: "Zalo",
    need: "A quote",
    stage: "new",
    context_summary: null,
    origin: "live",
    installation_id: "inst-1",
    created_at: "2026-10-12T10:00:00.000Z",
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "S", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const leads = mock<LeadReadService>()
    leads.list.mockResolvedValue([])
    leads.listByIds.mockResolvedValue([])
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.listOpen.mockResolvedValue([])
    const orders = mock<OrdersService>()
    orders.listForWorkbench.mockResolvedValue([])
    const invoices = mock<InvoicesService>()
    invoices.listForWorkbench.mockResolvedValue([])
    const conversations = mock<AgentConversationsService>()
    conversations.listCustomerLeadConversations.mockResolvedValue([])
    const messages = mock<AgentMessagesService>()
    messages.listForConversations.mockResolvedValue([])
    const executions = mock<ExecutionsService>()
    executions.list.mockResolvedValue([])
    const staff = mock<StaffDirectoryService>()
    staff.list.mockResolvedValue([])
    staff.namesOf.mockResolvedValue([])
    const events = mock<EventsService>()
    events.list.mockResolvedValue([])
    const items = mock<WorkItemsService>()
    items.listForWorkbench.mockResolvedValue([])
    const evidence = mock<EvidenceService>()
    evidence.listDecisions.mockResolvedValue([])
    const contracts = mock<ContractsService>()
    contracts.list.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesWorkbenchService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LeadReadService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: OrdersService, useValue: orders },
            { provide: InvoicesService, useValue: invoices },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ExecutionsService, useValue: executions },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: EventsService, useValue: events },
            { provide: WorkItemsService, useValue: items },
            { provide: EvidenceService, useValue: evidence },
            { provide: ContractsService, useValue: contracts },
        ],
    }).compile()
    return {
        workbench: moduleRef.get(SalesWorkbenchService),
        members,
        leads,
        conversations,
        messages,
        staff,
        events,
        items,
        executions,
    }
}

describe("SalesWorkbenchService", () => {
    describe("read", () => {
        it("proves membership and answers an empty workbench stamped with the clock", async () => {
            const { workbench, members, executions } = await build()

            await expect(workbench.read("user-1", "ws-1")).resolves.toMatchObject({
                nowIso: NOW,
                attention: [],
                deals: [],
                closedHidden: { won: 0, lost: 0 },
                decisions: [],
                decided: [],
                handoffs: [],
                activity: [],
                staff: [],
                contracts: [],
                leadOptions: [],
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(executions.list).toHaveBeenCalledWith("ws-1", { pendingLegacy: true, limit: 50 })
        })

        it("names the customers and people of the work items and reads the evidence of auto-done sales work", async () => {
            const { workbench, leads, staff, events, items } = await build()
            staff.list.mockResolvedValue([{ id: "staff-1", name: "Lan" }])
            items.listForWorkbench.mockResolvedValue([
                itemOf(),
                itemOf({ id: "item-2", lead_id: null, assigned_staff_id: null, status: "queued", decided_path: null }),
            ])

            await expect(workbench.read("user-1", "ws-1")).resolves.toMatchObject({
                staff: [{ id: "staff-1", name: "Lan" }],
            })
            expect(leads.listByIds).toHaveBeenCalledWith("ws-1", ["lead-1"])
            expect(staff.namesOf).toHaveBeenCalledWith("ws-1", ["staff-1"])
            expect(events.list.mock.calls).toEqual([
                ["ws-1", { kind: "outcome.recorded", limit: 600 }],
                ["ws-1", { kind: "work.auto_done", workItemIds: ["item-1"], limit: 200 }],
            ])
        })

        it("reads the messages of the customer conversations", async () => {
            const { workbench, conversations, messages } = await build()
            conversations.listCustomerLeadConversations.mockResolvedValue([
                { id: "conv-1", lead_id: "lead-1", handled_by: null },
                { id: "conv-2", lead_id: null, handled_by: "Lan" },
            ])

            await workbench.read("user-1", "ws-1")

            expect(messages.listForConversations).toHaveBeenCalledWith("ws-1", ["conv-1", "conv-2"], { limit: 800 })
        })

        it("excludes UAT and debug names from conversion while retaining ordinary customers", async () => {
            const { workbench, leads } = await build()
            leads.list.mockResolvedValue([
                leadOf(),
                leadOf({ id: "lead-2", contact_name: "UAT customer", company: "Company" }),
                leadOf({ id: "lead-3", contact_name: "Lan", company: "DBG company" }),
            ])

            const data = await workbench.read("user-1", "ws-1")

            expect(data.metrics.conversion).toEqual({
                windowDays: 90,
                leads: 1,
                won: 0,
                sources: [{ source: "Zalo", leads: 1, won: 0 }],
            })
            expect(data.deals.map((deal) => deal.leadId)).toEqual(["lead-1", "lead-2", "lead-3"])
        })

        it("provides a test-name policy that accepts absent names and finds markers in any name", async () => {
            const { workbench } = await build()
            const original = mapper.buildSalesWorkbench
            const buildWorkbench = jest.spyOn(mapper, "buildSalesWorkbench").mockImplementation((rows) => {
                expect(rows.isTestRun(null, undefined, "Mai", "Company")).toBe(false)
                expect(rows.isTestRun(null, "UAT customer")).toBe(true)
                expect(rows.isTestRun("Mai", undefined, "DBG company")).toBe(true)
                return original(rows)
            })

            try {
                await expect(workbench.read("user-1", "ws-1")).resolves.toMatchObject({
                    nowIso: NOW,
                    metrics: { conversion: { windowDays: 90, leads: 0, won: 0, sources: [] } },
                })
                expect(buildWorkbench).toHaveBeenCalledTimes(1)
            } finally {
                buildWorkbench.mockRestore()
            }
        })
    })
})
