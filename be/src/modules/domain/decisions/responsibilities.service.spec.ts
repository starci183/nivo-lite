import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { NewResponsibility, OptionalAgentIdentity, WorkContext } from "./decisions.contracts"
import { AGENT_DIRECTORY } from "./decisions.decorators"
import type { AgentDirectory } from "./decisions.port"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { ResponsibilityListingRow, ResponsibilityRow } from "./persistence/responsibilities.rows"
import {
    FIND_AGENT_NAME,
    FIND_LEAD_NAME,
    FIND_OPEN_RESPONSIBILITY,
    INSERT_RESPONSIBILITY,
    LIST_RESPONSIBILITIES,
    UPDATE_RESPONSIBILITY_STATUS,
} from "./persistence/responsibilities.sql"
import { ResponsibilitiesService } from "./responsibilities.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const rowOf = builder<ResponsibilityRow>({
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
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const directory = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(sales) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) => `${key}:${params.name ?? ""}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilitiesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENT_DIRECTORY, useValue: directory },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(ResponsibilitiesService), members, evidence, directory }
}

describe("ResponsibilitiesService", () => {
    describe("ensureFor", () => {
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

            await expect(service.ensureFor(ctx, "lead-9")).rejects.toMatchObject({ code: DecisionsErrorCode.NotFound })
        })

        it("refuses when the customer vanished before the insert", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_OPEN_RESPONSIBILITY, []],
                    [FIND_LEAD_NAME, [{ contact_name: "Binh" }]],
                    [INSERT_RESPONSIBILITY, []],
                ],
            })
            const { service } = await build(em)

            await expect(service.ensureFor(ctx, "lead-1")).rejects.toMatchObject({ code: DecisionsErrorCode.NotFound })
        })
    })

    describe("list", () => {
        it("lists the workspace's responsibilities for a member", async () => {
            const listing: ResponsibilityListingRow = { ...rowOf(), contact_name: "Binh" }
            const em = mockEntityManager({ query: [LIST_RESPONSIBILITIES, [listing]] })
            const { service, members } = await build(em)

            await expect(service.list("user-1", "ws-1")).resolves.toEqual([listing])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(LIST_RESPONSIBILITIES, ["ws-1"])
        })
    })

    describe("create", () => {
        it("adds a responsibility owned by the caller and logs it", async () => {
            const created = rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "An", next_action: "Call" })
            const em = mockEntityManager({ query: [INSERT_RESPONSIBILITY, [created]] })
            const { service, evidence } = await build(em)

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
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { lead_id: "lead-1", kind: "responsibility.assigned", actor: "An", summary: "An: Call" },
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
                code: DecisionsErrorCode.NotFound,
            })
        })
    })

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
                code: DecisionsErrorCode.NotFound,
            })
        })
    })
})
