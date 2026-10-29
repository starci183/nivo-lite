import { Test } from "@nestjs/testing"
import {
    AGENT_BOUND_CONNECTION,
    AGENT_LENS_COUNTS,
    AGENT_OPEN_GAPS,
    agentEntityOf,
    agentInstallationOf as installationOf,
    agentMemberOf as memberOf,
} from "@tests/fixtures/builders/agents.builder"
import { fakeQueryBuilder, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import type { InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"
import type { DashboardLine } from "./agents-reads.contracts"

const AGENT = agentEntityOf({ knowledge: "", approvalRule: "" })

const itemRowOf = builder<DashboardLine>({
    id: "wi1",
    action: "reply_customer",
    leadId: null,
    at: "2026-10-12T09:00:00.000Z",
    summary: "Price question",
    customer: "An",
    resultHref: null,
    total: "6",
})

const build = async (entityManager: MockEntityManager, member: WorkspaceMember = memberOf()) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(member)) })
    const installations = mock<InstallationDirectory>({
        firstOfModule: jest.fn(() => Promise.resolve(installationOf())),
        byId: jest.fn(() => Promise.resolve(installationOf())),
    })
    const knowledge = mock<KnowledgeLens>({
        countsFor: jest.fn(() => Promise.resolve(AGENT_LENS_COUNTS)),
        openGapsOf: jest.fn(() => Promise.resolve(AGENT_OPEN_GAPS)),
    })
    const bindings = mock<AgentBindingsService>({
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
            { provide: AGENTS_KNOWLEDGE, useValue: knowledge },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentOwnershipService, useValue: ownership },
        ],
    }).compile()
    return { service: moduleRef.get(AgentsService), members, installations, knowledge, bindings, logger, ownership }
}

/** The setup mode binds no knowledge lens, which the service holds as null. */
const buildSetupMode = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const installations = mock<InstallationDirectory>({ byId: jest.fn(() => Promise.resolve(installationOf())) })
    const bindings = mock<AgentBindingsService>({ connectionsFor: jest.fn(() => Promise.resolve([])) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_KNOWLEDGE, useValue: null },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentOwnershipService, useValue: mock<AgentOwnershipService>() },
        ],
    }).compile()
    return { service: moduleRef.get(AgentsService), logger }
}

describe("AgentsService profiles", () => {
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

describe("AgentsService list", () => {
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

describe("AgentsService agentOfDepartment", () => {
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

describe("AgentsService dashboard", () => {
    const stubs = mockEntityManager()
    const [waitingQuery, doneQuery] = queueQueryBuilders(stubs, [
        { getRawMany: [itemRowOf()] },
        { getRawMany: [itemRowOf({ id: "wi2", total: "2", resultHref: "/leads/l1" })] },
    ])

    it("loads the four regions of one instance for a manager", async () => {
        const { service, installations, knowledge, bindings } = await build(stubs)

        const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: "i1" })

        expect(data.agent).toEqual({ id: "a1", name: "Chatbot Q1", mode: "assist" })
        expect(data.waiting).toEqual({
            ok: true,
            data: {
                total: 6,
                items: [
                    {
                        id: "wi1",
                        title: "Price question",
                        action: "reply_customer",
                        customer: "An",
                        at: "2026-10-12T09:00:00.000Z",
                        leadId: null,
                        resultHref: null,
                        decisionHref: "/agents/chatbot/i1/workbench?focus=wi1",
                    },
                ],
            },
        })
        expect(data.done).toMatchObject({ ok: true, data: { count: 2 } })
        expect(data.connections).toEqual({
            ok: true,
            data: [
                {
                    id: "c1",
                    name: "Shop bot",
                    provider: "telegram",
                    botUsername: null,
                    accountMasked: null,
                    status: "connected",
                    access: "auto",
                    purpose: "inbound_chat",
                },
            ],
        })
        expect(data.knowledge).toMatchObject({ ok: true, data: { audience: "customer", gaps: { openCount: 2 } } })
        expect(installations.byId).toHaveBeenCalledWith("w1", "i1")
        expect(waitingQuery?.callsOf("where")[0]).toEqual([
            "w.workspaceId = :workspaceId AND w.department = :department",
            { workspaceId: "w1", department: "chatbot" },
        ])
        expect(waitingQuery?.callsOf("andWhere")).toEqual([
            [expect.stringContaining("~ :pattern"), { pattern: "UAT|DBG" }],
            ["w.installationId = :scopeId", { scopeId: "i1" }],
            ["w.status = 'waiting_decision'"],
        ])
        expect(waitingQuery?.callsOf("limit")).toEqual([[5]])
        expect(doneQuery?.callsOf("andWhere")).toEqual([
            [expect.stringContaining("~ :pattern"), { pattern: "UAT|DBG" }],
            ["w.installationId = :scopeId", { scopeId: "i1" }],
            [
                "w.status = 'done' AND w.decidedPath = 'auto' AND w.completedAt >= :since",
                { since: new Date("2026-10-05T10:00:00.000Z") },
            ],
        ])
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

describe("AgentsService dashboard", () => {
    it("reads the whole department of a single-instance type and hides the gaps from staff", async () => {
        const em = mockEntityManager()
        const [waitingQuery] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service, installations, knowledge } = await build(em, memberOf({ role: "staff" }))
        installations.firstOfModule.mockResolvedValue(installationOf({ isMulti: false }))

        const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

        expect(installations.firstOfModule).toHaveBeenCalledWith("w1", "chatbot")
        expect(waitingQuery?.callsOf("andWhere").map(([clause]) => clause)).not.toContain("w.installationId = :scopeId")
        expect(data.waiting).toEqual({ ok: true, data: { total: 0, items: [] } })
        expect(data.knowledge).toMatchObject({ ok: true, data: { gaps: null } })
        expect(knowledge.openGapsOf).not.toHaveBeenCalled()
    })

    it("has no agent and no connections for a module nobody installed", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service, installations, bindings } = await build(em)
        installations.firstOfModule.mockResolvedValue(null)

        const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: null })

        expect(data.agent).toBeNull()
        expect(data.connections).toEqual({ ok: true, data: [] })
        expect(bindings.connectionsFor).not.toHaveBeenCalled()
    })

    it("fails a region in place without taking the page down", async () => {
        const em = mockEntityManager()
        const failure = new AgentsError({ code: AgentsErrorCode.NotCreated })
        em.createQueryBuilder.mockImplementationOnce(() => {
            throw failure
        })
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service, logger } = await build(em)

        const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

        expect(data.waiting).toEqual({ ok: false })
        expect(data.done.ok).toBe(true)
        expect(logger.error).toHaveBeenCalledWith(AgentsLogEvent.DashboardRegionFailed, failure, {
            region: "waiting",
        })
    })

    it("fails the knowledge region alone in the setup mode, which binds no knowledge lens", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service, logger } = await buildSetupMode(em)

        const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

        expect(data.knowledge).toEqual({ ok: false })
        expect(logger.error).toHaveBeenCalledWith(
            AgentsLogEvent.DashboardRegionFailed,
            expect.objectContaining({ code: AgentsErrorCode.KnowledgeUnbound }),
            { region: "knowledge" },
        )
    })
})

/** Makes the insert of `em` fail with `cause`, as the database refuses it. */
const refuseInsert = (em: MockEntityManager, cause: unknown): void => {
    em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: () => Promise.reject(cause) }).builder)
}

describe("AgentsService create", () => {
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
        const em = mockEntityManager()
        refuseInsert(em, Object.assign(new AgentsError({ code: AgentsErrorCode.NotCreated }), { code: "23505" }))
        const { service } = await build(em)

        await expect(service.create("u1", agent)).rejects.toMatchObject({
            code: AgentsErrorCode.HandleTaken,
            params: { handle: "bot" },
        })
    })

    it.each([new AgentsError({ code: AgentsErrorCode.NotCreated }), null, "connection lost", { code: "23503" }])(
        "preserves a non-unique rejection: %p",
        async (failure) => {
            const em = mockEntityManager()
            refuseInsert(em, failure)
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

describe("AgentsService edits", () => {
    it("pauses and resumes an agent", async () => {
        const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
        const { service } = await build(em)

        await service.setStatus("u1", "w1", "a1", false)
        await service.setStatus("u1", "w1", "a1", true)

        expect(em.update).toHaveBeenNthCalledWith(1, AgentEntity, { id: "a1", workspaceId: "w1" }, { status: "paused" })
        expect(em.update).toHaveBeenNthCalledWith(2, AgentEntity, { id: "a1", workspaceId: "w1" }, { status: "active" })
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

    it("treats an update that reports no affected count as no agent", async () => {
        const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
        em.update.mockResolvedValueOnce({ raw: [], generatedMaps: [] })
        const { service } = await build(em)

        await expect(service.setStatus("u1", "w1", "ghost", true)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })

    it("refuses an agent that is not in the workspace", async () => {
        const { service } = await build(mockEntityManager({ update: [AgentEntity, { affected: 0 }] }))

        await expect(service.setStatus("u1", "w1", "ghost", true)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
            params: { id: "ghost" },
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
