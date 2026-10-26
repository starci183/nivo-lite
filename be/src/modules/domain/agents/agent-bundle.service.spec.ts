import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentBundleService } from "./agent-bundle.service"
import { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE, AGENTS_MODULES } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import type { Installation, InstallationDirectory, KnowledgeLens, ModuleProfiles } from "./agents.port"
import { AgentsErrorCode } from "./errors/agents.error"
import type { AgentRow } from "./persistence/agents.rows"
import { FIND_AGENT } from "./persistence/agents.sql"

const installationOf = builder<Installation>({
    id: "i1",
    workspaceId: "12345678-aaaa-bbbb-cccc-000000000000",
    module: "chatbot",
    name: "Chatbot",
    isMulti: false,
    agentId: "a1",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: "v1",
    liveEnabled: false,
    removed: false,
})

const AGENT: AgentRow = {
    id: "a1",
    workspace_id: "12345678-aaaa-bbbb-cccc-000000000000",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "",
    approval_rule: "",
    status: "active",
    avatar_url: null,
    created_at: "2026-10-01T00:00:00.000Z",
}

const echo = (key: string, params: Readonly<Record<string, string | number>>): string => {
    const entries = Object.entries(params).map(([name, value]) => `${name}=${String(value)}`)
    return entries.length === 0 ? key : `${key}(${entries.join("; ")})`
}

const build = async (entityManager: MockEntityManager) => {
    const installations = mock<InstallationDirectory>({
        contextVersionOf: jest.fn(() =>
            Promise.resolve({ version: 4, summary: "Spa", gates: [], facts: [], toneEvidence: "chi" }),
        ),
    })
    const knowledge = mock<KnowledgeLens>({
        audienceOf: jest.fn(() => "customer" as const),
        baseRulesOf: jest.fn(() =>
            Promise.resolve([
                { title: "Limit", body: "No discounts", kind: "authority" },
                { title: "Warm", body: "Be warm", kind: "tone" },
            ]),
        ),
        sourcesFor: jest.fn(() =>
            Promise.resolve([
                {
                    title: "Price",
                    topic: null,
                    kind: "document",
                    visibility: "public" as const,
                    updatedAt: "2026-10-11T08:00:00.000Z",
                    content: "Massage 300k",
                },
            ]),
        ),
        memoryFor: jest.fn(() => Promise.resolve("## Memory")),
    })
    const modules = mock<ModuleProfiles>({
        knowledgeFolderOf: jest.fn((module: string) => (module === "chatbot" ? "chatbot" : null)),
        replyContractOf: jest.fn((_module: string, base: string) => `CONTRACT[${base}]`),
        applicationClause: jest.fn(() => "CLAUSE"),
        applicationShape: jest.fn(() => "SHAPE"),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn(echo) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentBundleService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_KNOWLEDGE, useValue: knowledge },
            { provide: AGENTS_MODULES, useValue: modules },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AgentBundleService), installations, knowledge, modules, logger }
}

describe("AgentBundleService", () => {
    it("builds AGENTS.md, SOUL.md and one file per knowledge source for the installation", async () => {
        const em = mockEntityManager({ query: [FIND_AGENT, [AGENT]] })
        const { service, knowledge, installations } = await build(em)

        const bundle = await service.build(installationOf())

        expect(bundle).toMatchObject({
            installationId: "i1",
            workspaceId: "12345678-aaaa-bbbb-cccc-000000000000",
            module: "chatbot",
            agentId: "ws-12345678-chatbot",
            agentName: "Bot",
            contextVersion: 4,
            audience: "customer",
        })
        expect(bundle.files.map((file) => file.path)).toEqual(["AGENTS.md", "SOUL.md", "knowledge/01-price.md"])
        const agentsMd = bundle.files[0]?.content ?? ""
        expect(agentsMd).toContain("bundle.rulesSection(rules=### Limit\nNo discounts)")
        expect(agentsMd).toContain("bundle.contextSection(version=4; text=Spa)")
        expect(agentsMd).toContain("## Memory")
        expect(agentsMd).toContain("CONTRACT[bundle.replyContract(applicationClause=CLAUSE; applicationShape=SHAPE)]")
        expect(agentsMd).toContain("bundle.toolsTitle")
        expect(bundle.files[1]?.content).toContain("bundle.soulConfirmed(text=chi)")
        expect(bundle.files[1]?.content).toContain("bundle.soulGuidance(text=### Warm\nBe warm)")
        expect(em.query).toHaveBeenCalledWith(FIND_AGENT, ["a1", "12345678-aaaa-bbbb-cccc-000000000000"])
        expect(knowledge.baseRulesOf).toHaveBeenCalledWith(["chatbot", "core"])
        expect(knowledge.sourcesFor).toHaveBeenCalledWith("12345678-aaaa-bbbb-cccc-000000000000", "chatbot", "i1", 200)
        expect(installations.contextVersionOf).toHaveBeenCalledWith("v1")
    })

    it("builds without a persona, a context version or a reply contract", async () => {
        const { service, modules } = await build(mockEntityManager())
        modules.replyContractOf.mockReturnValue(null)

        const bundle = await service.build(installationOf({ agentId: null, activeContextVersionId: null }))

        expect(bundle.agentName).toBe("bundle.defaultAgentName(module=chatbot)")
        expect(bundle.contextVersion).toBeNull()
        expect(bundle.files[0]?.content).toContain("bundle.contextNone")
        expect(bundle.files[0]?.content).not.toContain("bundle.contractSection")
        expect(bundle.files[1]?.content).toContain("bundle.soulDefault")
    })

    it("builds without a persona when the agent row is gone", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_AGENT, []] }))

        const bundle = await service.build(installationOf())

        expect(bundle.agentName).toBe("bundle.defaultAgentName(module=chatbot)")
    })

    it("goes without the brain memory when it cannot be read", async () => {
        const { service, knowledge, logger } = await build(mockEntityManager({ query: [FIND_AGENT, [AGENT]] }))
        const failure = new Error("brain missing")
        knowledge.memoryFor.mockRejectedValue(failure)

        const bundle = await service.build(installationOf())

        expect(bundle.files[0]?.content).not.toContain("## Memory")
        expect(logger.error).toHaveBeenCalledWith(AgentsLogEvent.MemoryUnavailable, failure, { installationId: "i1" })
    })
})

describe("AgentBundleService", () => {
    it("refuses an installation whose module has no definition", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.build(installationOf({ module: "ghost" }))).rejects.toMatchObject({
            code: AgentsErrorCode.InstallationNotFound,
        })
    })

    it("refuses to build in the setup mode, which binds no knowledge lens", async () => {
        const entityManager = mockEntityManager()
        const installations = mock<InstallationDirectory>()
        const modules = mock<ModuleProfiles>({ knowledgeFolderOf: jest.fn(() => "chatbot") })
        const catalog = mock<MessageCatalog>()
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                AgentBundleService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: AGENTS_INSTALLATIONS, useValue: installations },
                { provide: AGENTS_KNOWLEDGE, useValue: null },
                { provide: AGENTS_MODULES, useValue: modules },
                { provide: MESSAGE_CATALOG, useValue: catalog },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        const service = moduleRef.get(AgentBundleService)

        await expect(service.build(installationOf())).rejects.toMatchObject({
            code: AgentsErrorCode.KnowledgeUnbound,
        })
    })
})
