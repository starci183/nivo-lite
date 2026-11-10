import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { InboxLeadsEventsService } from "./inbox-leads-events.service"
import type { LeadEventGroup, StrayEventGroup } from "./inbox-leads-events.service"
import { InboxLeadsRecordsService } from "./inbox-leads-records.service"
import type { LeadRecord, LeadRecords } from "./inbox-leads-records.service"
import { InboxLeadsService } from "./inbox-leads.service"
import type { InboxLeadsQuery } from "./inbox-leads.contracts"

const NOW = "2026-11-09T09:00:00.000Z"
const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const LEAD = "33333333-3333-4333-8333-333333333333"
const OTHER = "55555555-5555-4555-8555-555555555555"
const AGENT = "44444444-4444-4444-8444-444444444444"

const QUERY: InboxLeadsQuery = { tab: "all", channel: null, agentId: null, sort: "recent", search: null, limit: 60 }

const lead = (over: Partial<LeadRecord>): LeadRecord => ({
    id: LEAD,
    version: "1",
    createdAt: "2026-11-09T08:00:00.000Z",
    updatedAt: "2026-11-09T08:30:00.000Z",
    name: "Cam",
    channel: "website",
    stage: "new",
    need: "roses",
    contextSummary: null,
    phone: "84900000101",
    email: null,
    ownerAgentId: AGENT,
    nextStep: null,
    quoteVnd: 4000,
    note: null,
    ...over,
})

const group = (over: Partial<LeadEventGroup>): LeadEventGroup => ({
    lead_id: LEAD,
    event_count: 2,
    first_at: "2026-11-09T08:00:00.000Z",
    last_at: "2026-11-09T08:55:00.000Z",
    last_kind: "lead",
    last_body: "form",
    last_channel: "website",
    has_payment: false,
    ...over,
})

const stray = (over: Partial<StrayEventGroup>): StrayEventGroup => ({
    id: "event:e1",
    name: "",
    event_count: 1,
    first_at: "2026-11-08T08:00:00.000Z",
    last_at: "2026-11-08T08:00:00.000Z",
    last_kind: "payment",
    last_body: "transfer",
    last_channel: "bank",
    amount_vnd: 1080000,
    ...over,
})

const read = (leads: ReadonlyArray<LeadRecord>): LeadRecords => ({
    leads,
    orders: new Map([
        [
            LEAD,
            [
                {
                    id: "o1",
                    orderNo: "DH-1",
                    status: "draft",
                    amountVnd: 4000,
                    isShipped: false,
                    itemsText: "roses",
                    note: null,
                    createdAt: "2026-11-09T08:00:00.000Z",
                    updatedAt: "2026-11-09T08:00:00.000Z",
                },
            ],
        ],
    ]),
    conversations: new Map(),
    zaloLeadIds: new Set([LEAD]),
})

const member = (): WorkspaceMember => mock<WorkspaceMember>()

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const records = mock<InboxLeadsRecordsService>()
    const events = mock<InboxLeadsEventsService>()
    const directory = mock<AgentDirectoryService>()
    members.require.mockResolvedValue(member())
    events.groupsOf.mockResolvedValue([group({})])
    events.waitingOf.mockResolvedValue(new Map([[LEAD, 1]]))
    events.straysOf.mockResolvedValue([stray({})])
    events.weekOf.mockResolvedValue({ total: 4, auto: 3, mean_seconds: 40.4 })
    directory.activeOf.mockResolvedValue([{ id: AGENT, name: "Sales" }].map((card) => mock<AgentCard>(card)))
    directory.identitiesOf.mockResolvedValue([
        { id: AGENT, name: "Sales", handle: "sales", avatarUrl: null, avatarPreset: null },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxLeadsService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InboxLeadsRecordsService, useValue: records },
            { provide: InboxLeadsEventsService, useValue: events },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(InboxLeadsService), members, records, events, directory }
}

describe("InboxLeadsService list", () => {
    it("lists the customers of the tab with the counts of every tab, the figures and the agents", async () => {
        const { service, records, members } = await build()
        records.read.mockResolvedValue(read([lead({})]))

        const page = await service.list("user-1", WORKSPACE, { ...QUERY, tab: "needs_you" })

        expect(members.require).toHaveBeenCalledWith("user-1", WORKSPACE)
        expect(page.leads.map((row) => [row.id, row.stage, row.chips, row.agentName, row.via])).toEqual([
            [LEAD, "new", ["needs_you", "new"], "Sales", "form"],
        ])
        expect(page.counts).toEqual({ all: 2, new: 1, needsYou: 1, ordered: 0, paid: 1 })
        expect(page.figures).toEqual({
            visitors7d: 2,
            newToday: 1,
            needsYou: 1,
            autoReplyPct: 75,
            avgResponseSeconds: 40,
        })
        expect(page.agents).toEqual([{ id: AGENT, name: "Sales" }])
    })

    it("narrows by channel and agent, orders by the asked word and cuts at the limit", async () => {
        const { service, records } = await build()
        records.read.mockResolvedValue(
            read([lead({}), lead({ id: OTHER, name: "An", channel: "zalo", ownerAgentId: null })]),
        )

        const page = await service.list("user-1", WORKSPACE, {
            ...QUERY,
            channel: "zalo",
            sort: "name",
            limit: 1,
        })

        expect(page.leads.map((row) => row.id)).toEqual([OTHER])
        expect(page.counts.all).toBe(1)
    })

    it("searches the leads in the records and the customers with no lead in their words, and has no figures of a quiet week", async () => {
        const { service, records, events } = await build()
        records.read.mockResolvedValue(read([lead({})]))
        events.weekOf.mockResolvedValue({ total: 0, auto: 0, mean_seconds: null })

        const page = await service.list("user-1", WORKSPACE, { ...QUERY, search: "  transfer ", tab: "paid" })

        expect(records.read).toHaveBeenCalledWith(WORKSPACE, "transfer")
        expect(page.leads.map((row) => [row.id, row.isUnmatched, row.name])).toEqual([["event:e1", true, ""]])
        expect(page.figures).toMatchObject({ autoReplyPct: null, avgResponseSeconds: null })
    })

    it("shows the agent of the conversation when the owner has handed the customer to nobody", async () => {
        const { service, records } = await build()
        const withConversation = read([lead({ ownerAgentId: null })])
        records.read.mockResolvedValue({
            ...withConversation,
            conversations: new Map([[LEAD, { agentId: AGENT, status: "ai", lastText: "hi", channel: "website" }]]),
        })

        const page = await service.list("user-1", WORKSPACE, QUERY)

        expect(page.leads.find((row) => row.id === LEAD)).toMatchObject({ agentId: AGENT, agentName: "Sales" })
    })
})

describe("InboxLeadsService list defaults", () => {
    it("reads a lead with no inputs and no conversation from its own record", async () => {
        const { service, records, events } = await build()
        records.read.mockResolvedValue(read([lead({ ownerAgentId: null })]))
        events.groupsOf.mockResolvedValue([])
        events.waitingOf.mockResolvedValue(new Map())
        events.straysOf.mockResolvedValue([])

        const page = await service.list("user-1", WORKSPACE, QUERY)

        expect(page.leads[0]).toMatchObject({
            eventCount: 0,
            via: null,
            lastAt: "2026-11-09T08:30:00.000Z",
            agentId: null,
        })
    })
})

describe("InboxLeadsService detail", () => {
    it("opens a lead with what waits, what it needs, its journey, source and orders", async () => {
        const { service, records, events } = await build()
        records.read.mockResolvedValue(read([lead({})]))
        events.journeyOf.mockResolvedValue([
            {
                id: "e1",
                kind: "lead",
                channel: "website",
                body: "form",
                amount_vnd: null,
                source: { page: "/p" },
                sender_name: "Cam",
                sender_contact: null,
                created_at: "2026-11-09T08:00:00.000Z",
            },
        ])
        events.workOf.mockResolvedValue([])
        events.decisionsOf.mockResolvedValue([])

        const detail = await service.detail("user-1", WORKSPACE, LEAD)

        expect(records.read).toHaveBeenCalledWith(WORKSPACE, null, [LEAD])
        expect(detail).toMatchObject({
            phone: "84900000101",
            zaloLinked: true,
            approval: { orderId: "o1", agentName: "Sales" },
            source: { landing: "/p", channel: "website" },
            orders: [],
            paidCount: 0,
        })
        expect(detail.timeline.map((entry) => entry.id)).toEqual(["ev:e1"])
    })

    it("opens a lead whose work does not wait for a decision", async () => {
        const { service, records, events } = await build()
        records.read.mockResolvedValue(read([lead({})]))
        events.waitingOf.mockResolvedValue(new Map())
        events.journeyOf.mockResolvedValue([])
        events.workOf.mockResolvedValue([])
        events.decisionsOf.mockResolvedValue([])

        const detail = await service.detail("user-1", WORKSPACE, LEAD)

        expect(detail.lead.needsOwner).toBe(true)
        expect(detail.approval?.orderId).toBe("o1")
    })

    it("names the agent of the conversation of a lead nobody was handed to", async () => {
        const { service, records, events } = await build()
        const base = read([lead({ ownerAgentId: null })])
        records.read.mockResolvedValue({
            ...base,
            conversations: new Map([[LEAD, { agentId: AGENT, status: "ai", lastText: "hi", channel: "website" }]]),
        })
        events.journeyOf.mockResolvedValue([])
        events.workOf.mockResolvedValue([])
        events.decisionsOf.mockResolvedValue([])

        await expect(service.detail("user-1", WORKSPACE, LEAD)).resolves.toMatchObject({
            lead: { agentName: "Sales" },
        })
    })
})

describe("InboxLeadsService detail refusals", () => {
    it("refuses a lead that is not in the workspace", async () => {
        const { service, records } = await build()
        records.read.mockResolvedValue(read([]))

        await expect(service.detail("user-1", WORKSPACE, LEAD)).rejects.toMatchObject({
            code: "INBOX_LEADS_LEAD_NOT_FOUND",
        })
    })

    it("opens a customer that is no lead yet by the id of its group, and refuses one that is gone", async () => {
        const { service, events } = await build()
        events.journeyOf.mockResolvedValue([
            {
                id: "e1",
                kind: "payment",
                channel: "bank",
                body: "transfer",
                amount_vnd: 1080000,
                source: {},
                sender_name: null,
                sender_contact: "0900",
                created_at: "2026-11-08T08:00:00.000Z",
            },
        ])

        const detail = await service.detail("user-1", WORKSPACE, "event:e1")

        expect(events.journeyOf).toHaveBeenCalledWith(WORKSPACE, { stray: "event:e1" })
        expect(detail).toMatchObject({ phone: "0900", approval: null, orders: [], lead: { isUnmatched: true } })
        await expect(service.detail("user-1", WORKSPACE, "event:gone")).rejects.toMatchObject({
            code: "INBOX_LEADS_LEAD_NOT_FOUND",
        })
    })

    it("has no phone for a customer whose inputs name none", async () => {
        const { service, events } = await build()
        events.journeyOf.mockResolvedValue([])

        await expect(service.detail("user-1", WORKSPACE, "event:e1")).resolves.toMatchObject({ phone: null })
    })
})

describe("InboxLeadsService assign", () => {
    it("hands a lead to an agent of the workspace, as an owner or a manager", async () => {
        const { service, members, records, directory } = await build()
        directory.find.mockResolvedValue(mock<AgentCard>())

        await service.assign("user-1", WORKSPACE, LEAD, AGENT)

        expect(members.require).toHaveBeenCalledWith("user-1", WORKSPACE, ["owner", "manager"])
        expect(records.assign).toHaveBeenCalledWith(WORKSPACE, LEAD, AGENT)
    })

    it("takes a lead back without looking for an agent, and refuses an agent the workspace does not know", async () => {
        const { service, records, directory } = await build()

        await service.assign("user-1", WORKSPACE, LEAD, null)
        expect(directory.find).not.toHaveBeenCalled()
        expect(records.assign).toHaveBeenCalledWith(WORKSPACE, LEAD, null)

        directory.find.mockResolvedValue(null)
        await expect(service.assign("user-1", WORKSPACE, LEAD, AGENT)).rejects.toMatchObject({
            code: "INBOX_LEADS_AGENT_UNKNOWN",
        })
    })
})
