import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentSheet } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadCard } from "@modules/domain/leads"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import type { ResponsibilitySheet } from "@modules/domain/responsibilities"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsReadService } from "@modules/domain/work-items"
import type { WorkException } from "@modules/domain/work-items"
import { instant, OverviewReadsService } from "./overview-reads.service"

const AT = new Date("2026-10-12T03:00:00.123Z")
const AT_TEXT = "2026-10-12T03:00:00.123Z"

const CARD: LeadCard = {
    id: "l-1",
    contactName: "An",
    company: "Co",
    channel: "zalo",
    stage: "new",
    email: null,
}

const STEP: ResponsibilitySheet = {
    id: "r-1",
    leadId: "l-1",
    title: "Call",
    ownerKind: "agent",
    ownerAgentId: "a-1",
    ownerName: "Sales",
    nextAction: "Call back",
    dueAt: AT,
    status: "open",
    createdAt: AT,
}

const EXCEPTION: WorkException = {
    id: "w-1",
    leadId: "l-1",
    department: "sales",
    action: "reply",
    status: "failed",
    reason: null,
    error: "boom",
    executionId: "x-1",
    assignedStaffId: "s-1",
    createdAt: AT,
    summary: "Quote",
    contact: "An",
    customer: null,
}

const build = async () => {
    const responsibilities = mock<ResponsibilityReadService>()
    const agents = mock<AgentDirectoryService>()
    const events = mock<EventsService>()
    const leads = mock<LeadReadService>()
    const executions = mock<ExecutionsFiguresService>()
    const work = mock<WorkItemsReadService>()
    const staff = mock<StaffDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OverviewReadsService,
            { provide: ResponsibilityReadService, useValue: responsibilities },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: EventsService, useValue: events },
            { provide: LeadReadService, useValue: leads },
            { provide: ExecutionsFiguresService, useValue: executions },
            { provide: WorkItemsReadService, useValue: work },
            { provide: StaffDirectoryService, useValue: staff },
        ],
    }).compile()
    return {
        service: moduleRef.get(OverviewReadsService),
        responsibilities,
        agents,
        events,
        leads,
        executions,
        work,
        staff,
    }
}

describe("OverviewReadsService", () => {
    it("writes an instant as ISO text in UTC", () => {
        expect(instant(AT)).toBe(AT_TEXT)
    })

    it("nests the lead under each responsibility, bounds the read and drops a step whose lead is gone", async () => {
        const { service, responsibilities, leads } = await build()
        responsibilities.dueSoonest.mockResolvedValue([STEP, { ...STEP, id: "r-2", leadId: "l-gone", dueAt: null }])
        leads.cardsOf.mockResolvedValue([CARD])

        await expect(service.responsibilities("ws-1")).resolves.toEqual([
            {
                id: "r-1",
                leadId: "l-1",
                title: "Call",
                ownerKind: "agent",
                ownerAgentId: "a-1",
                ownerName: "Sales",
                nextAction: "Call back",
                dueAt: AT_TEXT,
                status: "open",
                createdAt: AT_TEXT,
                lead: { id: "l-1", contactName: "An", company: "Co", stage: "new" },
            },
        ])
        expect(responsibilities.dueSoonest).toHaveBeenCalledWith("ws-1", 2000)
        expect(leads.cardsOf).toHaveBeenCalledWith("ws-1", ["l-1", "l-gone"])
    })

    it("keeps an undated step undated", async () => {
        const { service, responsibilities, leads } = await build()
        responsibilities.dueSoonest.mockResolvedValue([{ ...STEP, dueAt: null }])
        leads.cardsOf.mockResolvedValue([CARD])

        const [step] = await service.responsibilities("ws-1")

        expect(step?.dueAt).toBeNull()
    })
})

describe("OverviewReadsService lists", () => {
    it("lists the agents with the creation time as text, bounded at 200", async () => {
        const { service, agents } = await build()
        const sheet: AgentSheet = {
            id: "a-1",
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open",
            greeting: "Hi",
            approvalRule: "Ask",
            status: "active",
            createdAt: AT,
        }
        agents.sheetsOf.mockResolvedValue([sheet])

        await expect(service.agents("ws-1")).resolves.toEqual([{ ...sheet, createdAt: AT_TEXT }])
        expect(agents.sheetsOf).toHaveBeenCalledWith("ws-1", 200)
    })

    it("limits the evidence lines to the count asked and names them in camel case", async () => {
        const { service, events } = await build()
        events.list.mockResolvedValue([
            {
                id: "e-1",
                lead_id: "l-1",
                kind: "k",
                actor: "a",
                summary: "s",
                evidence: null,
                created_at: AT_TEXT,
                work_item_id: null,
            },
        ])

        await expect(service.events("ws-1", 6)).resolves.toEqual([
            { id: "e-1", leadId: "l-1", kind: "k", actor: "a", summary: "s", evidence: null, createdAt: AT_TEXT },
        ])
        expect(events.list).toHaveBeenCalledWith("ws-1", { limit: 6 })
    })

    it("lists the leads the figures count, bounded at 10000", async () => {
        const { service, leads } = await build()
        leads.summariesOf.mockResolvedValue([
            { id: "l-1", contactName: "An", company: "Co", stage: "new", createdAt: AT },
        ])

        await expect(service.leads("ws-1")).resolves.toEqual([
            { id: "l-1", contactName: "An", company: "Co", stage: "new", createdAt: AT_TEXT },
        ])
        expect(leads.summariesOf).toHaveBeenCalledWith("ws-1", 10_000)
    })
})

describe("OverviewReadsService pending work", () => {
    it("adds the lead behind each waiting draft, or null when its step is gone", async () => {
        const { service, executions, responsibilities } = await build()
        executions.pendingOf.mockResolvedValue([
            { id: "x-1", responsibilityId: "r-1", createdAt: AT },
            { id: "x-2", responsibilityId: "r-gone", createdAt: AT },
        ])
        responsibilities.leadsOf.mockResolvedValue([{ id: "r-1", leadId: "l-1" }])

        await expect(service.pending("ws-1")).resolves.toEqual([
            { id: "x-1", responsibilityId: "r-1", createdAt: AT_TEXT, leadId: "l-1" },
            { id: "x-2", responsibilityId: "r-gone", createdAt: AT_TEXT, leadId: null },
        ])
        expect(executions.pendingOf).toHaveBeenCalledWith("ws-1", 2000)
        expect(responsibilities.leadsOf).toHaveBeenCalledWith("ws-1", ["r-1", "r-gone"])
    })

    it("fills the lead and the assigned staff name of an exception", async () => {
        const { service, work, leads, staff } = await build()
        work.exceptions.mockResolvedValue([EXCEPTION])
        leads.cardsOf.mockResolvedValue([CARD])
        staff.namesOf.mockResolvedValue([{ id: "s-1", name: "Lan" }])

        await expect(service.exceptions("ws-1")).resolves.toEqual([
            {
                id: "w-1",
                leadId: "l-1",
                department: "sales",
                action: "reply",
                status: "failed",
                reason: null,
                error: "boom",
                executionId: "x-1",
                assignedStaffName: "Lan",
                createdAt: AT_TEXT,
                summary: "Quote",
                contact: "An",
                customer: null,
                lead: { id: "l-1", contactName: "An", company: "Co", channel: "zalo" },
            },
        ])
        expect(work.exceptions).toHaveBeenCalledWith("ws-1", 100)
        expect(leads.cardsOf).toHaveBeenCalledWith("ws-1", ["l-1"])
        expect(staff.namesOf).toHaveBeenCalledWith("ws-1", ["s-1"])
    })

    it("answers a null lead and a null staff name for an exception with neither, or whose lead and staff are gone", async () => {
        const { service, work, leads, staff } = await build()
        work.exceptions.mockResolvedValue([
            { ...EXCEPTION, id: "w-2", leadId: null, assignedStaffId: null },
            { ...EXCEPTION, id: "w-3", leadId: "l-gone", assignedStaffId: "s-gone" },
        ])
        leads.cardsOf.mockResolvedValue([])
        staff.namesOf.mockResolvedValue([])

        const [none, gone] = await service.exceptions("ws-1")

        expect(none).toMatchObject({ id: "w-2", lead: null, assignedStaffName: null })
        expect(gone).toMatchObject({ id: "w-3", lead: null, assignedStaffName: null })
    })
})
