import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { AGENT_DIRECTORY } from "@modules/domain/messages"
import type { AgentDirectory, OptionalAgentIdentity } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import type {
    NewResponsibility,
    ResponsibilityListing,
    ResponsibilityRecord,
    ResponsibilityScope,
} from "./responsibility-journal.contracts"
import {
    FIND_AGENT_NAME,
    FIND_LEAD_NAME,
    FIND_OPEN_RESPONSIBILITY,
    FIND_OPEN_TITLED_RESPONSIBILITY,
    FIND_RESPONSIBILITY,
    INSERT_RESPONSIBILITY,
    LIST_BOARD_RESPONSIBILITIES,
    LIST_LEAD_RESPONSIBILITIES,
    LIST_OPEN_RESPONSIBILITIES,
    LIST_RESPONSIBILITIES,
    UPDATE_RESPONSIBILITY_NEXT_ACTION,
    UPDATE_RESPONSIBILITY_STATUS,
} from "./persistence/responsibility-journal.sql"
import { ResponsibilityJournalService } from "./responsibility-journal.service"

const registerEnsureFor = () => {
    describe("ensureFor", () => {
        registerResponsibilityOwnership()
        registerMissingCustomer()
    })

    describe("list", () => {
        it("lists the workspace's responsibilities for a member", async () => {
            const listing: ResponsibilityListing = {
                ...rowOf(),
                contact_name: "Binh",
                company: "Binh Co",
                leadStage: "new",
            }
            const em = mockEntityManager({ query: [LIST_RESPONSIBILITIES, [listing]] })
            const { service, members } = await build(em)

            await expect(service.list("user-1", "ws-1")).resolves.toEqual([listing])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(LIST_RESPONSIBILITIES, ["ws-1"])
        })
    })
}

const registerCreate = () => {
    describe("create", () => {
        it("adds a responsibility owned by the caller and logs it", async () => {
            const created = rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "An", next_action: "Call" })
            const em = mockEntityManager({ query: [INSERT_RESPONSIBILITY, [created]] })
            const { service, events } = await build(em)

            await expect(service.create("user-1", "ws-1", inputOf())).resolves.toEqual(created)

            expect(em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
                "ws-1",
                "lead-1",
                "Call Binh",
                "human",
                null,
                "An",
                "Call",
                null,
            ])
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    kind: "responsibility.assigned",
                    actor: "An",
                    summary: "An: Call",
                    leadId: "lead-1",
                },
                em,
            )
        })

        it("adds a responsibility owned by one of the workspace's agents", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AGENT_NAME, [{ id: "agent-1", name: "Sales Agent" }]],
                    [INSERT_RESPONSIBILITY, [rowOf()]],
                ],
            })
            const { service } = await build(em)

            await service.create("user-1", "ws-1", inputOf({ owner: "agent-1" }))

            expect(em.query).toHaveBeenCalledWith(FIND_AGENT_NAME, ["ws-1", "agent-1"])
            expect(em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
                "ws-1",
                "lead-1",
                "Call Binh",
                "agent",
                "agent-1",
                "Sales Agent",
                "Call",
                null,
            ])
        })

        it("refuses an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_AGENT_NAME, []] }))

            await expect(service.create("user-1", "ws-1", inputOf({ owner: "agent-9" }))).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.NotFound,
            })
        })
    })
}

const registerUpdateStatus = () => {
    describe("updateStatus", () => {
        it("moves the responsibility", async () => {
            const em = mockEntityManager({ query: [UPDATE_RESPONSIBILITY_STATUS, [rowOf({ status: "done" })]] })
            const { service, members } = await build(em)

            await expect(service.updateStatus("user-1", "ws-1", "resp-1", "done")).resolves.toEqual(
                rowOf({ status: "done" }),
            )
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY_STATUS, ["ws-1", "resp-1", "done"])
        })

        it("refuses a responsibility that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [UPDATE_RESPONSIBILITY_STATUS, []] }))

            await expect(service.updateStatus("user-1", "ws-1", "resp-9", "open")).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.NotFound,
            })
        })
    })

    describe("markWaitingApproval", () => {
        it("moves the responsibility to waiting for approval", async () => {
            const em = mockEntityManager({
                query: [UPDATE_RESPONSIBILITY_STATUS, [rowOf({ status: "waiting_approval" })]],
            })
            const { service } = await build(em)

            await service.markWaitingApproval(ctx, "resp-1")

            expect(em.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY_STATUS, ["ws-1", "resp-1", "waiting_approval"])
        })
    })

    describe("openNamed", () => {
        it("opens a human follow-up owned by the named person", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_OPEN_TITLED_RESPONSIBILITY, []],
                    [INSERT_RESPONSIBILITY, [rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "Linh" })]],
                ],
            })
            const { service } = await build(em)

            await expect(service.openNamed("ws-1", task)).resolves.toBe(true)
            expect(em.query).toHaveBeenCalledWith(FIND_OPEN_TITLED_RESPONSIBILITY, ["ws-1", "lead-1", "Nurture Binh"])
            expect(em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
                "ws-1",
                "lead-1",
                "Nurture Binh",
                "human",
                null,
                "Linh",
                "Call back",
                "2026-10-14T10:00:00.000Z",
            ])
        })

        it("opens nothing when the customer has an open one with the same title", async () => {
            const em = mockEntityManager({ query: [FIND_OPEN_TITLED_RESPONSIBILITY, [{ id: "resp-1" }]] })
            const { service } = await build(em)

            await expect(service.openNamed("ws-1", task)).resolves.toBe(false)
            expect(em.query).not.toHaveBeenCalledWith(INSERT_RESPONSIBILITY, expect.anything())
        })
    })
}

const registerJourneyAndBoardReaders = () => {
    describe("journey and board readers", () => {
        it("returns the customer's journey in the query's order", async () => {
            const rows = [rowOf(), rowOf({ id: "resp-2", status: "done" })]
            const em = mockEntityManager({ query: [LIST_LEAD_RESPONSIBILITIES, rows] })
            const { service } = await build(em)

            await expect(service.listForLead("ws-1", "lead-1")).resolves.toEqual(rows)
            expect(em.query).toHaveBeenCalledWith(LIST_LEAD_RESPONSIBILITIES, ["ws-1", "lead-1"])
        })

        it("returns the workspace's open follow-ups", async () => {
            const em = mockEntityManager({ query: [LIST_OPEN_RESPONSIBILITIES, [rowOf()]] })
            const { service } = await build(em)

            await expect(service.listOpen("ws-1")).resolves.toEqual([rowOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_OPEN_RESPONSIBILITIES, ["ws-1"])
        })

        it("returns the oldest open steps for the board", async () => {
            const em = mockEntityManager({ query: [LIST_BOARD_RESPONSIBILITIES, [rowOf()]] })
            const { service } = await build(em)

            await expect(service.listForBoard("ws-1")).resolves.toEqual([rowOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_BOARD_RESPONSIBILITIES, ["ws-1"])
        })
    })
}

const registerEngineUpdates = () => {
    describe("engine updates", () => {
        it("finds a responsibility with the primary manager", async () => {
            const em = mockEntityManager({ query: [FIND_RESPONSIBILITY, [rowOf()]] })
            const { service } = await build(em)

            await expect(service.find("ws-1", "resp-1")).resolves.toEqual(rowOf())
            expect(em.query).toHaveBeenCalledWith(FIND_RESPONSIBILITY, ["ws-1", "resp-1"])
        })

        it("returns null for a missing responsibility using the caller's transaction", async () => {
            const em = mockEntityManager()
            const transaction = mockEntityManager({ query: [FIND_RESPONSIBILITY, []] })
            const { service } = await build(em)

            await expect(service.find("ws-2", "missing", transaction)).resolves.toBeNull()
            expect(transaction.query).toHaveBeenCalledWith(FIND_RESPONSIBILITY, ["ws-2", "missing"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("sets a status through the primary manager", async () => {
            const em = mockEntityManager({ query: [UPDATE_RESPONSIBILITY_STATUS, []] })
            const { service } = await build(em)

            await expect(service.setStatus(ctx, "resp-1", "done")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY_STATUS, ["ws-1", "resp-1", "done"])
        })

        it("sets a status inside the supplied transaction", async () => {
            const em = mockEntityManager()
            const transaction = mockEntityManager({ query: [UPDATE_RESPONSIBILITY_STATUS, []] })
            const { service } = await build(em)

            await expect(service.setStatus(ctx, "resp-1", "waiting_approval", transaction)).resolves.toBeUndefined()
            expect(transaction.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY_STATUS, [
                "ws-1",
                "resp-1",
                "waiting_approval",
            ])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("sets the responsibility's next action", async () => {
            const em = mockEntityManager({ query: [UPDATE_RESPONSIBILITY_NEXT_ACTION, []] })
            const { service } = await build(em)

            await expect(service.setNextAction(ctx, "resp-1", "Send quote")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY_NEXT_ACTION, ["ws-1", "resp-1", "Send quote"])
        })
    })
}

const registerAgentAssignment = () => {
    it("creates and records an agent assignment in the caller's transaction", async () => {
        const em = mockEntityManager()
        const transaction = mockEntityManager({
            query: [
                [FIND_AGENT_NAME, [{ id: "agent-1", name: "Sales Agent" }]],
                [INSERT_RESPONSIBILITY, [rowOf()]],
            ],
        })
        const { service, members, events } = await build(em)

        await expect(service.create("user-1", "ws-1", inputOf({ owner: "agent-1" }), transaction)).resolves.toEqual(
            rowOf(),
        )
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(transaction.query).toHaveBeenCalledWith(FIND_AGENT_NAME, ["ws-1", "agent-1"])
        expect(transaction.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
            "ws-1",
            "lead-1",
            "Call Binh",
            "agent",
            "agent-1",
            "Sales Agent",
            "Call",
            null,
        ])
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                kind: "responsibility.assigned",
                actor: "An",
                summary: "Sales Agent: Classify",
                leadId: "lead-1",
            },
            transaction,
        )
        expect(em.query).not.toHaveBeenCalled()
    })
}

const registerResponsibilityOwnership = () => {
    it("answers the open responsibility of the customer", async () => {
        const em = mockEntityManager({ query: [FIND_OPEN_RESPONSIBILITY, [rowOf()]] })
        const { service } = await build(em)

        await expect(service.ensureFor(ctx, "lead-1")).resolves.toEqual(rowOf())
        expect(em.query).toHaveBeenCalledWith(FIND_OPEN_RESPONSIBILITY, ["ws-1", "lead-1"])
    })

    it("creates one owned by the Sales agent, due in a day", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OPEN_RESPONSIBILITY, []],
                [FIND_LEAD_NAME, [{ contact_name: "Binh" }]],
                [INSERT_RESPONSIBILITY, [rowOf()]],
            ],
        })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.ensureFor(ctx, "lead-1")).resolves.toEqual(rowOf())

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
        expect(em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
            "ws-1",
            "lead-1",
            "responsibility.title:Binh",
            "agent",
            "agent-1",
            "Sales Agent",
            "responsibility.next:",
            "2026-10-13T10:00:00.000Z",
        ])
    })

    it("is owned by the actor when the workspace has no Sales agent", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OPEN_RESPONSIBILITY, []],
                [FIND_LEAD_NAME, [{ contact_name: "Binh" }]],
                [INSERT_RESPONSIBILITY, [rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "An" })]],
            ],
        })
        const { service } = await build(em)

        await service.ensureFor(ctx, "lead-1")

        expect(em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
            "ws-1",
            "lead-1",
            "responsibility.title:Binh",
            "human",
            null,
            "An",
            "responsibility.next:",
            "2026-10-13T10:00:00.000Z",
        ])
    })

    it("refuses a customer that is not in the workspace", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OPEN_RESPONSIBILITY, []],
                [FIND_LEAD_NAME, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.ensureFor(ctx, "lead-9")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.NotFound,
        })
    })
}

const registerMissingCustomer = () => {
    it("refuses when the customer vanished before the insert", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OPEN_RESPONSIBILITY, []],
                [FIND_LEAD_NAME, [{ contact_name: "Binh" }]],
                [INSERT_RESPONSIBILITY, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.ensureFor(ctx, "lead-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.NotFound,
        })
    })
}

const task = {
    leadId: "lead-1",
    title: "Nurture Binh",
    ownerName: "Linh",
    nextAction: "Call back",
    dueAt: "2026-10-14T10:00:00.000Z",
}

const ctx: ResponsibilityScope = { workspaceId: "ws-1", actor: "An", locale: "en" }

const rowOf = builder<ResponsibilityRecord>({
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow up with Binh",
    owner_kind: "agent",
    owner_agent_id: "agent-1",
    owner_name: "Sales Agent",
    next_action: "Classify",
    due_at: "2026-10-13T10:00:00.000Z",
    status: "open",
    created_at: "2026-10-12T10:00:00.000Z",
})

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
})

const inputOf = builder<NewResponsibility>({
    lead_id: "lead-1",
    title: "Call Binh",
    owner: "human",
    next_action: "Call",
    due_at: null,
})

const build = async (entityManager: MockEntityManager, sales: OptionalAgentIdentity = null) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const directory = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(sales) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) => `${key}:${params.name ?? ""}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilityJournalService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENT_DIRECTORY, useValue: directory },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(ResponsibilityJournalService), members, events, directory }
}

describe("ResponsibilityJournalService", () => {
    registerEnsureFor()
    registerCreate()
    registerUpdateStatus()
    registerJourneyAndBoardReaders()
    registerEngineUpdates()
    registerAgentAssignment()
})
