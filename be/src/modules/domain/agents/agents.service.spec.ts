import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import type { Installation, InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"
import { AgentsErrorCode } from "./errors/agents.error"
import type { AgentRow } from "./persistence/agents.rows"
import {
    FIND_ACTIVE_AGENT,
    FIND_AGENT,
    FIND_FIRST_ACTIVE_AGENT,
    INSERT_AGENT,
    LIST_AGENTS,
    RENAME_AGENT,
    SET_AGENT_STATUS,
    SET_AGENT_TEXTS,
} from "./persistence/agents.sql"
import type { DashboardItemRow } from "./persistence/dashboard.rows"
import { LIST_DONE_ITEMS, LIST_WAITING_ITEMS } from "./persistence/dashboard.sql"

const AGENT: AgentRow = {
    id: "a1",
    workspace_id: "w1",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "",
    approval_rule: "",
    status: "active",
    created_at: "2026-10-01T00:00:00.000Z",
}

const installationOf = builder<Installation>({
    id: "i1",
    workspaceId: "w1",
    module: "chatbot",
    name: "Chatbot Q1",
    isMulti: true,
    agentId: "a1",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
})

const memberOf = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: "w1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const itemRowOf = builder<DashboardItemRow>({
    id: "wi1",
    action: "reply_customer",
    lead_id: null,
    at: "2026-10-12T09:00:00.000Z",
    summary: "Price question",
    customer: "An",
    result_href: null,
    total: "6",
})

const COUNTS = {
    audience: "customer" as const,
    documents: { public: 1, internal: 0 },
    facts: { public: 2, internal: 0, restricted: 0 },
}

const build = async (entityManager: MockEntityManager, member: WorkspaceMember = memberOf()) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(member)) })
    const installations = mock<InstallationDirectory>({
        firstOfModule: jest.fn(() => Promise.resolve(installationOf())),
        byId: jest.fn(() => Promise.resolve(installationOf())),
    })
    const knowledge = mock<KnowledgeLens>({
        countsFor: jest.fn(() => Promise.resolve(COUNTS)),
        openGapsOf: jest.fn(() =>
            Promise.resolve({
                openCount: 2,
                items: [{ id: "g1", question: "Opening hours?", count: 3, lastSeenAt: "2026-10-11T00:00:00.000Z" }],
            }),
        ),
    })
    const bindings = mock<AgentBindingsService>({
        connectionsFor: jest.fn(() =>
            Promise.resolve([
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    status: "connected",
                    access: "auto" as const,
                    purpose: "inbound_chat" as const,
                    botUsername: null,
                    accountMasked: null,
                },
            ]),
        ),
    })
    const logger = mock<Logger>()
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
        ],
    }).compile()
    return { service: moduleRef.get(AgentsService), members, installations, knowledge, bindings, logger }
}

describe("AgentsService", () => {
    describe("profiles", () => {
        it("reads the complete profile of an agent regardless of its status", async () => {
            const em = mockEntityManager({ query: [FIND_AGENT, [{ ...AGENT, status: "paused" }]] })
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
            expect(em.query).toHaveBeenCalledWith(FIND_AGENT, ["a1", "w1"])
            expect(members.require).not.toHaveBeenCalled()
        })

        it("answers no profile when the agent is absent", async () => {
            const em = mockEntityManager({ query: [FIND_AGENT, []] })
            const { service } = await build(em)

            await expect(service.profileOf("w1", "ghost")).resolves.toBeNull()
            expect(em.query).toHaveBeenCalledWith(FIND_AGENT, ["ghost", "w1"])
        })

        it("reads the department's first active agent profile", async () => {
            const em = mockEntityManager({ query: [FIND_FIRST_ACTIVE_AGENT, [AGENT]] })
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
            expect(em.query).toHaveBeenCalledWith(FIND_FIRST_ACTIVE_AGENT, ["w1", "chatbot"])
        })

        it("answers no department profile when it has no active agent", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_FIRST_ACTIVE_AGENT, []] }))

            await expect(service.profileOfDepartment("w1", "chatbot")).resolves.toBeNull()
        })
    })
})

describe("AgentsService", () => {
    describe("list", () => {
        it("lists the agents of the workspace for a member", async () => {
            const em = mockEntityManager({ query: [LIST_AGENTS, [AGENT]] })
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
                    createdAt: "2026-10-01T00:00:00.000Z",
                },
            ])
            expect(members.require).toHaveBeenCalledWith("u1", "w1")
            expect(em.query).toHaveBeenCalledWith(LIST_AGENTS, ["w1", "chatbot"])
        })

        it("lists every module when none is named", async () => {
            const em = mockEntityManager({ query: [LIST_AGENTS, []] })
            const { service } = await build(em)

            await service.list("u1", "w1")

            expect(em.query).toHaveBeenCalledWith(LIST_AGENTS, ["w1", null])
        })
    })

    describe("agentOfDepartment", () => {
        it("answers the agent of the item's own instance", async () => {
            const em = mockEntityManager({ query: [FIND_ACTIVE_AGENT, [AGENT]] })
            const { service, installations } = await build(em)

            await expect(service.agentOfDepartment("w1", "chatbot", "i1")).resolves.toEqual({ id: "a1", name: "Bot" })
            expect(installations.byId).toHaveBeenCalledWith("w1", "i1")
            expect(em.query).toHaveBeenCalledWith(FIND_ACTIVE_AGENT, ["a1", "w1"])
        })

        it("answers the first active agent of the department without an instance", async () => {
            const em = mockEntityManager({ query: [FIND_FIRST_ACTIVE_AGENT, [AGENT]] })
            const { service, installations } = await build(em)

            await expect(service.agentOfDepartment("w1", "chatbot", null)).resolves.toEqual({ id: "a1", name: "Bot" })
            expect(installations.byId).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenCalledWith(FIND_FIRST_ACTIVE_AGENT, ["w1", "chatbot"])
        })

        it("falls back to the department when the instance has no agent, and answers nobody when there is none", async () => {
            const em = mockEntityManager({ query: [FIND_FIRST_ACTIVE_AGENT, []] })
            const { service, installations } = await build(em)
            installations.byId.mockResolvedValue(installationOf({ agentId: null }))

            await expect(service.agentOfDepartment("w1", "chatbot", "i1")).resolves.toBeNull()
        })
    })
})

describe("AgentsService", () => {
    describe("dashboard", () => {
        const stubs = mockEntityManager({
            query: [
                [LIST_WAITING_ITEMS, [itemRowOf()]],
                [LIST_DONE_ITEMS, [itemRowOf({ id: "wi2", total: "2", result_href: "/leads/l1" })]],
            ],
        })

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
            expect(stubs.query).toHaveBeenNthCalledWith(1, LIST_WAITING_ITEMS, ["w1", "chatbot", "i1", "UAT|DBG", 5])
            expect(stubs.query).toHaveBeenNthCalledWith(2, LIST_DONE_ITEMS, [
                "w1",
                "chatbot",
                "i1",
                "UAT|DBG",
                "2026-10-05T10:00:00.000Z",
                5,
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
})

describe("AgentsService", () => {
    describe("dashboard", () => {
        it("reads the whole department of a single-instance type and hides the gaps from staff", async () => {
            const em = mockEntityManager({
                query: [
                    [LIST_WAITING_ITEMS, []],
                    [LIST_DONE_ITEMS, []],
                ],
            })
            const { service, installations, knowledge } = await build(em, memberOf({ role: "staff" }))
            installations.firstOfModule.mockResolvedValue(installationOf({ isMulti: false }))

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

            expect(installations.firstOfModule).toHaveBeenCalledWith("w1", "chatbot")
            expect(em.query).toHaveBeenNthCalledWith(1, LIST_WAITING_ITEMS, ["w1", "chatbot", null, "UAT|DBG", 5])
            expect(data.waiting).toEqual({ ok: true, data: { total: 0, items: [] } })
            expect(data.knowledge).toMatchObject({ ok: true, data: { gaps: null } })
            expect(knowledge.openGapsOf).not.toHaveBeenCalled()
        })

        it("has no agent and no connections for a module nobody installed", async () => {
            const em = mockEntityManager({
                query: [
                    [LIST_WAITING_ITEMS, []],
                    [LIST_DONE_ITEMS, []],
                ],
            })
            const { service, installations, bindings } = await build(em)
            installations.firstOfModule.mockResolvedValue(null)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot", installationId: null })

            expect(data.agent).toBeNull()
            expect(data.connections).toEqual({ ok: true, data: [] })
            expect(bindings.connectionsFor).not.toHaveBeenCalled()
        })

        it("fails a region in place without taking the page down", async () => {
            const em = mockEntityManager({
                query: [
                    [LIST_WAITING_ITEMS, []],
                    [LIST_DONE_ITEMS, []],
                ],
            })
            const failure = new Error("table missing")
            em.query.mockRejectedValueOnce(failure)
            const { service, logger } = await build(em)

            const data = await service.dashboard("u1", { workspaceId: "w1", module: "chatbot" })

            expect(data.waiting).toEqual({ ok: false })
            expect(data.done.ok).toBe(true)
            expect(logger.error).toHaveBeenCalledWith(AgentsLogEvent.DashboardRegionFailed, failure, {
                region: "waiting",
            })
        })
    })
})

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
            const em = mockEntityManager({ query: [INSERT_AGENT, [AGENT]] })
            const { service, members } = await build(em)

            await expect(service.create("u1", agent)).resolves.toMatchObject({ id: "a1", handle: "bot" })
            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(INSERT_AGENT, [
                "w1",
                "chatbot",
                "Bot",
                "bot",
                "Front desk",
                "Be kind",
            ])
        })

        it("refuses a handle another agent uses", async () => {
            const em = mockEntityManager({ query: [INSERT_AGENT, []] })
            em.query.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }))
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toMatchObject({
                code: AgentsErrorCode.HandleTaken,
                params: { handle: "bot" },
            })
        })

        it("rethrows any other database failure", async () => {
            const em = mockEntityManager({ query: [INSERT_AGENT, []] })
            const failure = new Error("connection lost")
            em.query.mockRejectedValueOnce(failure)
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toBe(failure)
        })

        it.each([null, "connection lost", { code: "23503" }])(
            "preserves a non-unique rejection: %p",
            async (failure) => {
                const em = mockEntityManager({ query: [INSERT_AGENT, []] })
                em.query.mockRejectedValueOnce(failure)
                const { service } = await build(em)

                await expect(service.create("u1", agent)).rejects.toBe(failure)
            },
        )

        it("refuses when the insert answers no row", async () => {
            const { service } = await build(mockEntityManager({ query: [INSERT_AGENT, []] }))

            await expect(service.create("u1", agent)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
        })
    })
})

describe("AgentsService", () => {
    describe("edits", () => {
        it("renames an agent", async () => {
            const em = mockEntityManager({ query: [RENAME_AGENT, [{ id: "a1" }]] })
            const { service, members } = await build(em)

            await service.rename("u1", "w1", "a1", "New name")

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(RENAME_AGENT, ["a1", "w1", "New name"])
        })

        it("pauses and resumes an agent", async () => {
            const em = mockEntityManager({ query: [SET_AGENT_STATUS, [{ id: "a1" }]] })
            const { service } = await build(em)

            await service.setStatus("u1", "w1", "a1", false)
            await service.setStatus("u1", "w1", "a1", true)

            expect(em.query).toHaveBeenNthCalledWith(1, SET_AGENT_STATUS, ["a1", "w1", "paused"])
            expect(em.query).toHaveBeenNthCalledWith(2, SET_AGENT_STATUS, ["a1", "w1", "active"])
        })

        it("replaces the texts of an agent", async () => {
            const em = mockEntityManager({ query: [SET_AGENT_TEXTS, [{ id: "a1" }]] })
            const { service } = await build(em)

            await service.setTexts("u1", "w1", "a1", { instructions: "i", knowledge: "k" })

            expect(em.query).toHaveBeenCalledWith(SET_AGENT_TEXTS, ["a1", "w1", "i", "k"])
        })

        it("refuses an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [RENAME_AGENT, []] }))

            await expect(service.rename("u1", "w1", "ghost", "x")).rejects.toMatchObject({
                code: AgentsErrorCode.AgentNotFound,
                params: { id: "ghost" },
            })
        })
    })
})
