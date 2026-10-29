import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ExecutionsService } from "@modules/domain/executions"
import type { ExecutionRecordRow } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import { MessagesReadService } from "@modules/domain/messages"
import type { OfficeThreadLine } from "@modules/domain/messages"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { OfficeCommandCandidatesErrorCode } from "./errors/office-command-candidates.error"
import { OfficeThreadService } from "./office-thread.service"

const member: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "s-1",
    displayName: "An",
    status: "active",
}

const EXEC_ID = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"
const ITEM_ID = "1b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"
const OTHER_ID = "2b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"

const lineOf = builder<OfficeThreadLine>({
    id: "m-1",
    author_kind: "human",
    author_name: "An",
    author_user_id: null,
    agent_id: null,
    staff_id: null,
    body: "hi",
    lead_id: null,
    work_item_id: null,
    room: null,
    card_json: null,
    created_at: "2026-10-12T10:00:00+00:00",
})

const cardOf = (kind: string, id: string): string => JSON.stringify({ ref: { kind, id } })

const recordOf = builder<ExecutionRecordRow>({
    id: "x-1",
    workspace_id: "ws-1",
    responsibility_id: "r-1",
    agent_id: null,
    kind: "follow_up",
    draft: "Hello",
    status: "pending_approval",
    decided_by: null,
    work_item_id: null,
    decided_at: null,
    created_at: "2026-10-12T10:00:00+00:00",
})

const itemOf = (id: string, status: WorkItem["status"], extra: Partial<WorkItem> = {}) =>
    mock<WorkItem>({
        id,
        workspace_id: "ws-1",
        department: "sales",
        status,
        assigned_staff_id: null,
        ...extra,
    })

/** What the owner capabilities answer; every read defaults to nothing. */
interface Answers {
    readonly lines?: Array<OfficeThreadLine>
    readonly records?: Array<ExecutionRecordRow>
    readonly statuses?: Array<{ id: string; status: string }>
    readonly items?: Array<WorkItem>
}

const build = async (answers: Answers = {}) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member) })
    const lines = mock<MessagesReadService>({ page: jest.fn().mockResolvedValue(answers.lines ?? []) })
    const leads = mock<LeadReadService>({
        cardsOf: jest
            .fn()
            .mockResolvedValue([
                { id: "l-1", contactName: "Lan", company: "", channel: "zalo", stage: "new", email: null },
            ]),
    })
    const workItems = mock<WorkItemsService>({ findMany: jest.fn().mockResolvedValue(answers.items ?? []) })
    const executions = mock<ExecutionsService>({
        pendingApprovals: jest.fn().mockResolvedValue(answers.records ?? []),
        decidedApprovals: jest.fn().mockResolvedValue(answers.records ?? []),
        statusesOf: jest.fn().mockResolvedValue(answers.statuses ?? []),
    })
    const steps = mock<ResponsibilityReadService>({
        stepsOf: jest
            .fn()
            .mockResolvedValue([{ id: "r-1", leadId: "l-1", nextAction: "Call", ownerName: "An", title: "t" }]),
    })
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest.fn().mockResolvedValue([{ id: "a-1", name: "Mai", module: "sales", canTagAgentIds: [] }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeThreadService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MessagesReadService, useValue: lines },
            { provide: LeadReadService, useValue: leads },
            { provide: WorkItemsService, useValue: workItems },
            { provide: ExecutionsService, useValue: executions },
            { provide: ResponsibilityReadService, useValue: steps },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeThreadService), members, lines, leads, workItems, executions, steps, agents }
}

describe("OfficeThreadService messages", () => {
    it("reads the newest page after proving membership and cuts it at the page size", async () => {
        const rows = [lineOf({ id: "m-3" }), lineOf({ id: "m-2" }), lineOf({ id: "m-1" })]
        const { service, members, lines } = await build({ lines: rows })

        const page = await service.messages("u-1", "ws-1", { before: null, limit: 2, room: null })

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(lines.page).toHaveBeenCalledWith("ws-1", { room: null, before: null, size: 2 })
        expect(page.messages.map((line) => line.id)).toEqual(["m-3", "m-2"])
        expect(page.next).toEqual({ createdAt: "2026-10-12T10:00:00+00:00", id: "m-2" })
    })

    it("names the customer, the department and the live state of every card", async () => {
        const rows = [
            lineOf({ id: "m-1", lead_id: "l-1", work_item_id: ITEM_ID }),
            lineOf({ id: "m-2", card_json: cardOf("execution", EXEC_ID) }),
            lineOf({ id: "m-3", card_json: cardOf("work_item", ITEM_ID) }),
            lineOf({ id: "m-4", card_json: cardOf("work_item", OTHER_ID) }),
            lineOf({ id: "m-5", card_json: cardOf("execution", "not-an-id") }),
            lineOf({ id: "m-6", card_json: cardOf("handoff", EXEC_ID) }),
            lineOf({ id: "m-7", card_json: JSON.stringify({ title: "no ref" }) }),
            lineOf({ id: "m-8", card_json: cardOf("work_item", "not-an-id") }),
        ]
        const { service, leads, workItems, executions } = await build({
            lines: rows,
            statuses: [{ id: EXEC_ID, status: "approved" }],
            items: [
                itemOf(ITEM_ID, "waiting_decision"),
                itemOf(OTHER_ID, "done", { workspace_id: "ws-2", department: "care" }),
            ],
        })

        const page = await service.messages("u-1", "ws-1", { before: null, limit: 20, room: null })

        expect(leads.cardsOf).toHaveBeenCalledWith("ws-1", ["l-1"])
        expect(workItems.findMany).toHaveBeenCalledWith([ITEM_ID, OTHER_ID], 2)
        expect(executions.statusesOf).toHaveBeenCalledWith("ws-1", [EXEC_ID])
        expect(page.messages.map((line) => [line.lead_name, line.department, line.card_state])).toEqual([
            ["Lan", "sales", null],
            [null, null, "approved"],
            [null, null, "pending"],
            [null, null, "info"],
            [null, null, "info"],
            [null, null, "info"],
            [null, null, "info"],
            [null, null, "info"],
        ])
    })
})

describe("OfficeThreadService card states", () => {
    it("states the other work item outcomes", async () => {
        const rows = [0, 1, 2, 3].map((index) =>
            lineOf({
                id: `m-${index}`,
                card_json: cardOf("work_item", `${index}b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b`),
            }),
        )
        const { service } = await build({
            lines: rows,
            items: (["done", "rejected", "failed", "queued"] as const).map((status, index) =>
                itemOf(`${index}b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b`, status),
            ),
        })

        const page = await service.messages("u-1", "ws-1", { before: null, limit: 20, room: null })

        expect(page.messages.map((line) => line.card_state)).toEqual(["done", "declined", "failed", "queued"])
    })

    it("states a declined execution", async () => {
        const { service } = await build({
            lines: [lineOf({ card_json: cardOf("execution", EXEC_ID) })],
            statuses: [{ id: EXEC_ID, status: "rejected" }],
        })

        const page = await service.messages("u-1", "ws-1", { before: null, limit: 20, room: null })

        expect(page.messages[0]?.card_state).toBe("declined")
    })

    it("states a waiting execution as pending", async () => {
        const { service } = await build({
            lines: [lineOf({ card_json: cardOf("execution", EXEC_ID) })],
            statuses: [{ id: EXEC_ID, status: "pending_approval" }],
        })

        const page = await service.messages("u-1", "ws-1", { before: null, limit: 20, room: null })

        expect(page.messages[0]?.card_state).toBe("pending")
    })
})

describe("OfficeThreadService message paging", () => {
    it("continues after a cursor and clamps the page size", async () => {
        const { service, lines } = await build()
        const id = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"
        const before = { createdAt: "2026-10-12T10:00:00Z", id }

        const page = await service.messages("u-1", "ws-1", { before, limit: 9999, room: "marketing" })

        expect(lines.page).toHaveBeenCalledWith("ws-1", { room: "marketing", before, size: 100 })
        expect(page).toEqual({ messages: [], next: null })
    })

    it("refuses a cursor that is not a position", async () => {
        const { service, lines } = await build()

        await expect(
            service.messages("u-1", "ws-1", { before: { createdAt: "later", id: "x" }, limit: 10, room: null }),
        ).rejects.toMatchObject({ code: OfficeCommandCandidatesErrorCode.PageInvalid })
        expect(lines.page).not.toHaveBeenCalled()
    })

    it("refuses a room that is not a Hub room", async () => {
        const { service, lines } = await build()

        await expect(service.messages("u-1", "ws-1", { before: null, limit: 10, room: "lobby" })).rejects.toMatchObject(
            {
                code: OfficeCommandCandidatesErrorCode.PageInvalid,
            },
        )
        expect(lines.page).not.toHaveBeenCalled()
    })
})

describe("OfficeThreadService approvals", () => {
    it("lists the waiting executions as cards with the step, the customer, the agent and the work item", async () => {
        const { service, members, executions, steps, workItems } = await build({
            records: [recordOf({ agent_id: "a-1", work_item_id: ITEM_ID })],
            items: [itemOf(ITEM_ID, "waiting_decision", { assigned_staff_id: "s-9" })],
        })

        const cards = await service.pendingApprovals("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(executions.pendingApprovals).toHaveBeenCalledWith("ws-1", 100)
        expect(steps.stepsOf).toHaveBeenCalledWith("ws-1", ["r-1"])
        expect(workItems.findMany).toHaveBeenCalledWith([ITEM_ID], 1)
        expect(cards).toHaveLength(1)
        expect(cards[0]).toMatchObject({
            id: "x-1",
            leadName: "Lan",
            leadId: "l-1",
            agentName: "Mai",
            channel: "zalo",
            nextAction: "Call",
            assignedStaffId: "s-9",
        })
    })

    it("falls back to the owner when no agent wrote the draft and to blanks when the step is gone", async () => {
        const { service, steps } = await build({ records: [recordOf({ responsibility_id: "r-gone" })] })
        steps.stepsOf.mockResolvedValue([])

        const cards = await service.pendingApprovals("u-1", "ws-1")

        expect(cards[0]).toMatchObject({
            leadName: null,
            leadId: null,
            agentName: null,
            nextAction: "",
            channel: "",
        })
    })

    it("lists the last eight decided executions", async () => {
        const { service, executions } = await build({
            records: [recordOf({ status: "approved" }), recordOf({ id: "x-2", status: "rejected" })],
        })

        const cards = await service.decidedApprovals("u-1", "ws-1")

        expect(executions.decidedApprovals).toHaveBeenCalledWith("ws-1", 8)
        expect(cards.map((card) => card.status)).toEqual(["approved", "rejected"])
    })
})
