import { Test } from "@nestjs/testing"
import {
    AGENT_BOUND_CONNECTION,
    AGENT_LENS_COUNTS,
    AGENT_OPEN_GAPS,
    agentEntityOf,
    agentInstallationOf as installationOf,
    agentMemberOf as memberOf,
} from "@tests/fixtures/builders/agents.builder"
import {
    CONNECTIONS_EXPECTED,
    DASHBOARD_LISTS,
    WAITING_EXPECTED,
} from "@tests/fixtures/builders/agents-dashboard.builder"
import type { Lists } from "@tests/fixtures/builders/agents-dashboard.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AGENTS_CONNECTIONS, AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import type { AgentConnectionsDirectory, InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const AGENT = agentEntityOf({ knowledge: "", approvalRule: "" })

const build = async (
    entityManager: MockEntityManager,
    member: WorkspaceMember = memberOf(),
    lists: Lists = {},
    bindKnowledge = true,
) => {
    const work = mock<WorkItemsActivityService>()
    work.dashboardList.mockImplementation((query) =>
        Promise.resolve([...(query.kind === "waiting" ? (lists.waiting ?? []) : (lists.done ?? []))]),
    )
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(member)) })
    const installations = mock<InstallationDirectory>({
        firstOfModule: jest.fn(() => Promise.resolve(installationOf())),
        byId: jest.fn(() => Promise.resolve(installationOf())),
    })
    const knowledge = mock<KnowledgeLens>({
        countsFor: jest.fn(() => Promise.resolve(AGENT_LENS_COUNTS)),
        openGapsOf: jest.fn(() => Promise.resolve(AGENT_OPEN_GAPS)),
    })
    const bindings = mock<AgentConnectionsDirectory>({
        connectionsFor: jest.fn(() => Promise.resolve([AGENT_BOUND_CONNECTION])),
    })
    const logger = mock<Logger>()
    const ownership = mock<AgentOwnershipService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_KNOWLEDGE, useValue: bindKnowledge ? knowledge : null },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AGENTS_CONNECTIONS, useValue: bindings },
            { provide: AgentOwnershipService, useValue: ownership },
            { provide: WorkItemsActivityService, useValue: work },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentsService),
        members,
        installations,
        knowledge,
        bindings,
        logger,
        ownership,
        work,
    }
}

describe("AgentsService", () => {
    describe("profiles", () => {
        it("reads the complete profile of an agent regardless of its status", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, { ...AGENT, status: "paused" }] })
            const { service, members } = await build(em)

            await expect(service.profileOf("w1", "a1")).resolves.toEqual({
                id: "a1",
                name: "Bot",
                handle: "bot",
                role: "Front desk",
                instructions: "Be kind",
                knowledge: "",
                approval_rule: "",
            })
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1", workspaceId: "w1" } })
            expect(members.require).not.toHaveBeenCalled()
        })

        it("answers no profile when the agent is absent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })
            const { service } = await build(em)

            await expect(service.profileOf("w1", "ghost")).resolves.toBeNull()
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "ghost", workspaceId: "w1" } })
        })

        it("reads the department's first active agent profile", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, AGENT] })
            const { service } = await build(em)

            await expect(service.profileOfDepartment("w1", "chatbot")).resolves.toEqual({
                id: "a1",
                name: "Bot",
                handle: "bot",
                role: "Front desk",
                instructions: "Be kind",
                knowledge: "",
                approval_rule: "",
            })
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                where: { workspaceId: "w1", module: "chatbot", status: "active" },
                order: { createdAt: "ASC", id: "ASC" },
            })
        })

        it("answers no department profile when it has no active agent", async () => {
            const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }))

            await expect(service.profileOfDepartment("w1", "chatbot")).resolves.toBeNull()
        })
    })
})

describe("AgentsService", () => {
    describe("list", () => {
        it("lists the agents of the workspace for a member", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [AGENT]] })
            const { service, members } = await build(em)

            const agents = await service.list("u1", "w1", "chatbot")

            expect(agents).toEqual([
                {
                    id: "a1",
                    module: "chatbot",
                    name: "Bot",
                    handle: "bot",
                    role: "Front desk",
                    status: "active",
                    avatarUrl: null,
                    createdAt: "2026-10-01T00:00:00.000Z",
                },
            ])
            expect(members.require).toHaveBeenCalledWith("u1", "w1")
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                where: { workspaceId: "w1", module: "chatbot" },
                order: { createdAt: "ASC", id: "ASC" },
                take: 200,
            })
        })

        it("lists every module when none is named", async () => {
            const em = mockEntityManager({ find: [AgentEntity, []] })
            const { service } = await build(em)

            await service.list("u1", "w1")

            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                where: { workspaceId: "w1" },
                order: { createdAt: "ASC", id: "ASC" },
                take: 200,
            })
        })
    })

    describe("agentOfDepartment", () => {
        it("answers the agent of the item's own instance", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, AGENT] })
            const { service, installations } = await build(em)

            await expect(service.agentOfDepartment("w1", "chatbot", "i1")).resolves.toEqual({ id: "a1", name: "Bot" })
            expect(installations.byId).toHaveBeenCalledWith("w1", "i1")
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                where: { id: "a1", workspaceId: "w1", status: "active" },
            })
        })

        it("answers the first active agent of the department without an instance", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, AGENT] })
            const { service, installations } = await build(em)

            await expect(service.agentOfDepartment("w1", "chatbot", null)).resolves.toEqual({ id: "a1", name: "Bot" })
            expect(installations.byId).not.toHaveBeenCalled()
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                where: { workspaceId: "w1", module: "chatbot", status: "active" },
                order: { createdAt: "ASC", id: "ASC" },
            })
        })

        it("falls back to the department when the instance has no agent, and answers nobody when there is none", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })
            const { service, installations } = await build(em)
            installations.byId.mockResolvedValue(installationOf({ agentId: null }))

            await expect(service.agentOfDepartment("w1", "chatbot", "i1")).resolves.toBeNull()
        })
    })
})

describe("AgentsService agentById", () => {
    it("answers the agent of the workspace with the id, active or paused", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, AGENT] })
        const { service } = await build(em)

        await expect(service.agentById("w1", "a1")).resolves.toEqual({ id: "a1", name: "Bot" })
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1", workspaceId: "w1" } })
    })

    it("answers nobody for an agent the workspace does not have", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, null] })
        const { service } = await build(em)

        await expect(service.agentById("w1", "a9")).resolves.toBeNull()
    })
})

describe("AgentsService", () => {
    describe("dashboard", () => {
        const stubs = mockEntityManager()

        it("loads the four regions of one instance for a manager", async () => {
            const { service, installations } = await build(stubs, memberOf(), DASHBOARD_LISTS)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: "i1" })

            expect(data.agent).toEqual({ id: "a1", name: "Chatbot Q1", mode: "assist" })
            expect(data.waiting).toEqual(WAITING_EXPECTED)
            expect(data.done).toMatchObject({ ok: true, data: { count: 2 } })
            expect(data.connections).toEqual(CONNECTIONS_EXPECTED)
            expect(data.knowledge).toMatchObject({ ok: true, data: { audience: "customer", gaps: { openCount: 2 } } })
            expect(installations.byId).toHaveBeenCalledWith("w1", "i1")
        })

        it("asks the work item reads, the lenses and the bindings with the instance scope", async () => {
            const { service, knowledge, bindings, work } = await build(stubs, memberOf(), DASHBOARD_LISTS)

            await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: "i1" })

            expect(work.dashboardList).toHaveBeenCalledWith({
                workspaceId: "w1",
                department: "chatbot",
                installationId: "i1",
                kind: "waiting",
                since: null,
                testRunPattern: "UAT|DBG",
                limit: 5,
            })
            expect(work.dashboardList).toHaveBeenCalledWith({
                workspaceId: "w1",
                department: "chatbot",
                installationId: "i1",
                kind: "done",
                since: new Date("2026-10-05T10:00:00.000Z"),
                testRunPattern: "UAT|DBG",
                limit: 5,
            })
            expect(knowledge.countsFor).toHaveBeenCalledWith("w1", "chatbot", "i1")
            expect(knowledge.openGapsOf).toHaveBeenCalledWith("w1", "chatbot", 3)
            expect(bindings.connectionsFor).toHaveBeenCalledWith("a1", [
                "inbound_chat",
                "outbound_chat",
                "bank_feed",
                "data_source",
                "tool",
            ])
        })
    })
})

describe("AgentsService", () => {
    describe("dashboard", () => {
        it("reads the whole department of a single-instance type and hides the gaps from staff", async () => {
            const em = mockEntityManager()
            const { service, installations, knowledge, work } = await build(em, memberOf({ role: "staff" }))
            installations.firstOfModule.mockResolvedValue(installationOf({ isMulti: false }))

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

            expect(installations.firstOfModule).toHaveBeenCalledWith("w1", "chatbot")
            expect(work.dashboardList).toHaveBeenCalledWith(expect.objectContaining({ installationId: null }))
            expect(data.waiting).toEqual({ ok: true, data: { total: 0, items: [] } })
            expect(data.knowledge).toMatchObject({ ok: true, data: { gaps: null } })
            expect(knowledge.openGapsOf).not.toHaveBeenCalled()
        })

        it("has no agent and no connections for a module nobody installed", async () => {
            const em = mockEntityManager()
            const { service, installations, bindings } = await build(em)
            installations.firstOfModule.mockResolvedValue(null)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: null })

            expect(data.agent).toBeNull()
            expect(data.connections).toEqual({ ok: true, data: [] })
            expect(bindings.connectionsFor).not.toHaveBeenCalled()
        })

        it("fails a region in place without taking the page down", async () => {
            const em = mockEntityManager()
            const failure = new Error("table missing")
            const { service, logger, work } = await build(em)
            work.dashboardList.mockRejectedValueOnce(failure)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

            expect(data.waiting).toEqual({ ok: false })
            expect(data.done.ok).toBe(true)
            expect(logger.error).toHaveBeenCalledWith(AgentsLogEvent.DashboardRegionFailed, failure, {
                region: "waiting",
            })
        })

        it("fails the knowledge region alone in the setup mode, which binds no knowledge lens", async () => {
            const em = mockEntityManager()
            const { service, logger } = await build(em, memberOf(), {}, false)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

            expect(data.knowledge).toEqual({ ok: false })
            expect(logger.error).toHaveBeenCalledWith(
                AgentsLogEvent.DashboardRegionFailed,
                expect.objectContaining({ code: AgentsErrorCode.KnowledgeUnbound }),
                { region: "knowledge" },
            )
        })
    })
})

/** A manager whose insert is refused by the database with `cause`. */
const rejectedInsert = (cause: unknown) => {
    const em = mockEntityManager()
    em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: () => Promise.reject(cause) }).builder)
    return em
}

describe("AgentsService", () => {
    describe("create", () => {
        const agent = {
            workspaceId: "w1",
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
        }

        it("adds the agent for a manager", async () => {
            const em = mockEntityManager()
            const insert = fakeQueryBuilder({ execute: { raw: [AGENT] } })
            em.createQueryBuilder.mockReturnValue(insert.builder)
            const { service, members } = await build(em)

            await expect(service.create("u1", agent)).resolves.toMatchObject({ id: "a1", handle: "bot" })
            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentEntity, "ag")
            expect(insert.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "w1",
                        module: "chatbot",
                        name: "Bot",
                        handle: "bot",
                        role: "Front desk",
                        instructions: "Be kind",
                    },
                ],
            ])
        })

        it("refuses a handle another agent uses", async () => {
            const em = rejectedInsert(Object.assign(new Error("duplicate"), { code: "23505" }))
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toMatchObject({
                code: AgentsErrorCode.HandleTaken,
                params: { handle: "bot" },
            })
        })

        it("rethrows any other database failure", async () => {
            const failure = new Error("connection lost")
            const em = rejectedInsert(failure)
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toBe(failure)
        })

        it.each([null, "connection lost", { code: "23503" }])(
            "preserves a non-unique rejection: %p",
            async (failure) => {
                const em = rejectedInsert(failure)
                const { service } = await build(em)

                await expect(service.create("u1", agent)).rejects.toBe(failure)
            },
        )

        it("refuses when the insert answers no row", async () => {
            const em = mockEntityManager()
            em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: { raw: [] } }).builder)
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
        })
    })
})

describe("AgentsService", () => {
    describe("edits", () => {
        it("pauses and resumes an agent", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service } = await build(em)

            await service.setStatus("u1", "w1", "a1", false)
            await service.setStatus("u1", "w1", "a1", true)

            expect(em.update).toHaveBeenNthCalledWith(
                1,
                AgentEntity,
                { id: "a1", workspaceId: "w1" },
                { status: "paused" },
            )
            expect(em.update).toHaveBeenNthCalledWith(
                2,
                AgentEntity,
                { id: "a1", workspaceId: "w1" },
                { status: "active" },
            )
        })

        it("replaces the texts of an agent", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service } = await build(em)

            await service.setTexts("u1", "w1", "a1", { instructions: "i", knowledge: "k" })

            expect(em.update).toHaveBeenCalledWith(
                AgentEntity,
                { id: "a1", workspaceId: "w1" },
                { instructions: "i", knowledge: "k" },
            )
        })

        it("refuses an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ update: [AgentEntity, { affected: 0 }] }))

            await expect(service.setStatus("u1", "w1", "ghost", true)).rejects.toMatchObject({
                code: AgentsErrorCode.AgentNotFound,
                params: { id: "ghost" },
            })
        })
    })
})

describe("AgentsService ownership questions", () => {
    it("answers who owns, who may be tagged and who may assign through the ownership service", async () => {
        const { service, ownership } = await build(mockEntityManager({}))
        ownership.ownerOf.mockResolvedValue({ ownerMemberId: "m1", fallbackMemberId: null })
        ownership.canTag.mockResolvedValue(true)
        ownership.canAssign.mockResolvedValue(false)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m1", fallbackMemberId: null })
        await expect(service.canTag("a1", "a2")).resolves.toBe(true)
        await expect(service.canAssign("m1", "a1")).resolves.toBe(false)
        expect(ownership.canTag).toHaveBeenCalledWith("a1", "a2")
        expect(ownership.canAssign).toHaveBeenCalledWith("m1", "a1")
    })
})
