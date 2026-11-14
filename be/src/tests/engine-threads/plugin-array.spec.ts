import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { nodeIndexOf, runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { EntityManager } from "typeorm"
import { toModuleDefinitionType } from "@features/api/modules/transport/graphql/modules.mapper"
import { AgentGraphTurnPolicyService } from "@modules/domain/agent-graphs/agent-graph-turn-policy.service"
import { installedModules } from "@tests/fixtures/builders/installed-modules.builder"
import { RunStopRecordsService } from "@modules/domain/agent-threads/stops/run-stop-records.service"
import { AgentWorkflowAdoptionService } from "@modules/domain/agent-graphs/agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "@modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs/agent-workflows-admin.service"
import { AgentGraphsErrorCode } from "@modules/domain/agent-graphs/errors/agent-graphs.error"
import { withDefaultReads } from "@modules/domain/agent-graphs/policies/agent-tools.policy"
import { requireSoundFlow } from "@modules/domain/agent-graphs/policies/flow.policy"
import { EntityEngineService, EntityNodePortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { GRAPH_NODES_OPTIONS } from "@modules/domain/graph-nodes/graph-nodes.decorators"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { AgentAccountsService } from "@modules/domain/tools"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import {
    MODULE_CATALOG,
    MODULE_CATEGORIES,
    ModuleAccessService,
    ModuleInstallService,
    ModulesService,
} from "@modules/domain/modules"
import { ModulesErrorCode } from "@modules/domain/modules/errors/modules.error"
import { MODULES_OPTIONS } from "@modules/domain/modules/modules.decorators"
import { AdminAccessService, AdminEnterpriseService } from "@modules/domain/platform-admin"
import { PlatformAdminErrorCode } from "@modules/domain/platform-admin/errors/platform-admin.error"
import { PLATFORM_ADMIN_OPTIONS } from "@modules/domain/platform-admin/platform-admin.decorators"
import { GraphSeedService } from "@modules/domain/workspace-seed/graph-seed.service"
import { WorkspaceSeedErrorCode } from "@modules/domain/workspace-seed/errors/workspace-seed.error"
import { SEED_AGENTS, WORKSPACE_SEED_OPTIONS } from "@modules/domain/workspace-seed/workspace-seed.decorators"
import { ModulesService as CatalogService } from "@modules/domain/modules"
import { WorkspaceEnterpriseService, WorkspacesService } from "@modules/domain/workspaces"
import { WorkspacesErrorCode } from "@modules/domain/workspaces/errors/workspaces.error"
import { WorkspaceEntity } from "@modules/domain/workspaces/persistence/entities"
import { AgentGraphFlowService, AgentWorkflowsService } from "@modules/domain/agent-graphs"
import { AgentGraphRunQueueService } from "@modules/domain/agent-graphs/agent-graph-run-queue.service"
import type { Principal } from "@modules/platform/cqrs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import {
    FIXTURE_ENTERPRISE,
    FIXTURE_GUIDANCE,
    FIXTURE_MODULE,
    FIXTURE_OVERREACH_GRAPH,
    FIXTURE_PRIMARY,
    FIXTURE_SECONDARY,
    FIXTURE_TOOL,
    FIXTURE_TOOL_WORDS,
} from "@tests/fixtures/builders/fixture-plugin.builder"

/** The lookup a workspace read is asked: by id or by enterprise key. */
interface WorkspaceWhere {
    /** The workspace id. */
    id?: string
    /** The enterprise key. */
    enterpriseKey?: string
}

/** The options of a workspace read. */
interface WorkspaceFind {
    /** The lookup. */
    where: WorkspaceWhere
}

/** The patch of a workspace update. */
interface EnterprisePatch {
    /** The new enterprise key, or null to clear it. */
    enterpriseKey: string | null
}

/** The where of a workspace update. */
interface IdWhere {
    /** The workspace id. */
    id: string
}


// PLUGIN-AGENTS: the engine reads every declaration from the ARRAY of installed plugins (the core package is one of them), never from
// a package by name. Here the array is `[core, fixture]`: the generated registry is replaced by the same join over the core plugin and
// a tiny private fixture plugin, and every service below is the real one (only stores and neighbours are doubles). The fixture agent
// then runs by the same code paths a core agent runs by; `plugin-array-removed.spec.ts` takes the plugin out of the array.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/fixture-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/fixture-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.FIXTURE_PLUGIN], "fixture-array") }
})

/** The enterprise workspace the fixture plugin names, another enterprise workspace, and an ordinary one (uuid only). */
const WS_ENTERPRISE = "11111111-1111-4111-8111-111111111111"
const WS_OTHER = "22222222-2222-4222-8222-222222222222"
const WS_ORDINARY = "33333333-3333-4333-8333-333333333333"

/** The workspaces table as far as the enterprise identifier reads and writes it. */
const workspacesStore = () => {
    const keys = new Map<string, string | null>([
        [WS_ENTERPRISE, FIXTURE_ENTERPRISE],
        [WS_OTHER, "other-co"],
        [WS_ORDINARY, null],
    ])
    const em = mock<EntityManager>()
    const rowOf = (id: string): WorkspaceEntity =>
        Object.assign(new WorkspaceEntity(), { id, enterpriseKey: keys.get(id) ?? null })
    em.findOne.mockImplementation(((_entity: unknown, options: WorkspaceFind) => {
        const { id, enterpriseKey } = options.where
        if (id !== undefined) return Promise.resolve(keys.has(id) ? rowOf(id) : null)
        const holder = [...keys].find(([, key]) => key === enterpriseKey)
        return Promise.resolve(holder === undefined ? null : rowOf(holder[0]))
    }) as never)
    em.update.mockImplementation(((_entity: unknown, where: IdWhere, patch: EnterprisePatch) => {
        keys.set(where.id, patch.enterpriseKey)
        return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] })
    }) as never)
    // The catalogue mirror of the seed (`ModulesService.sync`): written nowhere here.
    em.upsert.mockResolvedValue({ identifiers: [], raw: [], generatedMaps: [] })
    em.find.mockResolvedValue([])
    em.transaction.mockImplementation(((work: (tx: EntityManager) => unknown) => Promise.resolve(work(em))) as never)
    return { em, keys }
}

/** The real services under test over the one workspaces store; every other dependency is a double. */
const world = async () => {
    const { em, keys } = workspacesStore()
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    engine.definition.mockImplementation(() => {
        throw new Error("no entity in this world")
    })
    const records = mock<AgentWorkflowRecordsService>()
    records.workflowsOf.mockResolvedValue([])
    const installations = mock<InstallationRecordsService>()
    const flows = mock<AgentGraphFlowService>()
    const workflows = mock<AgentWorkflowsService>()
    const workspaces = mock<WorkspacesService>()
    const print = jest.fn()
    // The workspace connected one Zalo OA: the account a messaging default is proposed on.
    const connections = mock<ConnectionBindingsReadService>()
    connections.ofProvider.mockImplementation(((_workspace: string, provider: string) =>
        Promise.resolve(provider === "zalo_oa" ? [{ id: "conn-zalo", name: "OA", status: "connected" }] : [])) as never)
    connections.recordOf.mockResolvedValue(null as never)
    const rights = mock<AccountAttachmentsService>()
    rights.insertMissing.mockImplementation(((entries: ReadonlyArray<unknown>) => Promise.resolve(entries)) as never)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceEnterpriseService,
            AgentGraphTurnPolicyService,
            // The run queue: the auto-mocker would hand the turn policy a mock whose snapshot answers nothing; this world has no queue to read.
            { provide: AgentGraphRunQueueService, useValue: mock<AgentGraphRunQueueService>({ snapshotOf: () => Promise.resolve([]), waitingOf: () => Promise.resolve(0) }) },
            ModulesService,
            ModuleAccessService,
            ModuleInstallService,
            AgentWorkflowAdoptionService,
            AgentWorkflowsAdminService,
            GraphSeedService,
            GraphNodeRegistryService,
            AgentAccountsService,
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: AccountAttachmentsService, useValue: rights },
            AdminAccessService,
            AdminEnterpriseService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentWorkflowRecordsService, useValue: records },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphFlowService, useValue: flows },
            { provide: AgentWorkflowsService, useValue: workflows },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MODULES_OPTIONS, useValue: { categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG } },
            { provide: PLATFORM_ADMIN_OPTIONS, useValue: { admins: ["admin@nivo.test"] } },
            { provide: GRAPH_NODES_OPTIONS, useValue: { install: INSTALLED.nodeInstall() } },
            { provide: WORKSPACE_SEED_OPTIONS, useValue: { print, nodes: INSTALLED.nodeInstall() } },
            { provide: SEED_AGENTS, useValue: mock() },
            { provide: EntityNodePortsService, useValue: { ports: () => [] } },
            // The stops of the engine's tables: this workspace has none.
            { provide: RunStopRecordsService, useValue: mock<RunStopRecordsService>({ ofContacts: jest.fn().mockResolvedValue([]) }) },
            { provide: LOGGER, useValue: mock() },
        ],
    })
        .useMocker(() => mock())
        .compile()
    return {
        em,
        keys,
        records,
        installations,
        flows,
        workflows,
        workspaces,
        enterprise: moduleRef.get(WorkspaceEnterpriseService),
        policy: moduleRef.get(AgentGraphTurnPolicyService),
        access: moduleRef.get(ModuleAccessService),
        install: moduleRef.get(ModuleInstallService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        admin: moduleRef.get(AgentWorkflowsAdminService),
        seed: moduleRef.get(GraphSeedService),
        registry: moduleRef.get(GraphNodeRegistryService),
        adminEnterprise: moduleRef.get(AdminEnterpriseService),
        abilities: moduleRef.get(AgentAccountsService),
        rights,
        catalog: moduleRef.get(CatalogService),
    }
}

const turnOf = (workspaceId: string): NodeTurn => ({
    turnId: "run-1",
    workspaceId,
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
})

const ADMIN: Principal = { id: "admin-1", email: "admin@nivo.test", role: "authenticated" }
const OWNER: Principal = { id: "owner-1", email: "owner@shop.test", role: "authenticated" }

describe("the installation is the array of plugins: a plugin's agent runs by the core agent's code paths", () => {
    it("lists the fixture plugin after the core plugin, with its label and who may use it", () => {
        expect(INSTALLED.plugins.map((plugin) => plugin.key)).toEqual(["core", "fixture"])
        expect(INSTALLED.pluginOfModule(FIXTURE_MODULE)).toMatchObject({
            key: "fixture",
            label: { vi: "Thu", en: "Fixture" },
            visibility: "private",
            enterprises: [FIXTURE_ENTERPRISE],
        })
        expect(INSTALLED.pluginOfModule("sales")).toMatchObject({ key: "core", visibility: "public" })
    })

    it("tells the fixture agent its plugin's guidance and its tool set, in the enterprise workspace", async () => {
        const { policy } = await world()
        const told = await policy.toldOf(turnOf(WS_ENTERPRISE), FIXTURE_MODULE, "run-1:step")
        expect(told.guidance).toBe(`POLICY: ${FIXTURE_GUIDANCE.vi}`)
        expect(told.agentTools).toEqual(withDefaultReads([TOOL.teamMessagePost, FIXTURE_TOOL]))
    })

    it.each(installedModules().filter((module) => module.agent !== undefined).map((module) => module.key))(
        "tells the installed %s agent exactly what its plugin declares, and reads no workspace for it",
        async (moduleKey) => {
            const { policy, em } = await world()
            const agent = INSTALLED.moduleOf(moduleKey)?.agent
            for (const locale of ["vi", "en"] as const) {
                const told = await policy.toldOf({ ...turnOf(WS_ORDINARY), locale }, moduleKey, "run-1:step")
                expect(told.guidance).toBe(INSTALLED.guidanceOf(moduleKey, locale))
                expect(told.agentTools).toEqual(withDefaultReads(agent?.tools ?? []))
            }
            expect(em.findOne).not.toHaveBeenCalled()
        },
    )

    it("admits a workflow whose step uses the agent's own tool and a core tool it reuses, and refuses a tool outside its set", () => {
        const installed = nodeIndexOf(INSTALLED.nodeInstall())
        const [version] = FIXTURE_PRIMARY.versions
        expect(() => requireSoundFlow(version!.graph, installed)).not.toThrow()
        let refusal: unknown
        try {
            requireSoundFlow(FIXTURE_OVERREACH_GRAPH, installed)
        } catch (error) {
            refusal = error
        }
        expect(refusal).toMatchObject({ code: AgentGraphsErrorCode.PublishRefused })
        expect(JSON.stringify((refusal as { params?: unknown }).params)).toContain(
            `GRAPH_TOOL_OUTSIDE_AGENT step:${TOOL.agentTag}`,
        )
    })

    it("carries the fixture tool's label, model words and node model beside the core ones", () => {
        expect(INSTALLED.toolLabelOf(FIXTURE_TOOL)?.title.en).toBe("Open a ticket")
        expect(INSTALLED.nodeInstall().words?.("fixdeskTicketOpen")).toBe(FIXTURE_TOOL_WORDS)
        expect(INSTALLED.nodeModelOf("fixdesk.intake")).toEqual({ model: "auto", weight: "light" })
        expect(INSTALLED.nodeModelOf("sales.consult-turn")).not.toBeNull()
    })

    it("proposes the fixture agent the account of the provider its declaration names, on the account the workspace connected", async () => {
        const { abilities } = await world()
        expect(INSTALLED.abilityDefaultsOf(FIXTURE_MODULE)).toEqual({ kinds: { messaging: { "customer.send": "ask" } } })
        await expect(abilities.proposalOf(WS_ENTERPRISE, FIXTURE_MODULE)).resolves.toEqual([
            { connectionId: "conn-zalo", provider: "zalo_oa" },
        ])
    })

    it("runs the fixture node through the installed node registry", async () => {
        const { registry } = await world()
        const index = registry.installed()
        const node = index.nodes.get("fixdesk.intake")
        expect(node).toBeDefined()
        const { ports } = fakeNodePorts()
        const ran = await runNode(
            {
                node: node!,
                params: {},
                input: { subject: "site down" },
                turn: EXAMPLE_TURN,
                grant: { },
                effects: index.effects,
                tools: index.tools,
                key: "run-1:step",
            },
            ports,
        )
        expect(ran.output).toEqual({ opened: "site down" })
        expect(index.effects.has(FIXTURE_TOOL)).toBe(true)
    })
})

describe("a private plugin's modules are open only to the enterprise workspaces it names", () => {
    it("lists the module in the agents catalogue of the matching enterprise workspace only, with its plugin label", async () => {
        const { access } = await world()
        const keysFor = async (workspaceId: string | null): Promise<ReadonlyArray<string>> =>
            (await access.catalogFor("u-1", workspaceId)).modules.map((module) => module.key)
        expect(await keysFor(WS_ORDINARY)).not.toContain(FIXTURE_MODULE)
        expect(await keysFor(WS_OTHER)).not.toContain(FIXTURE_MODULE)
        expect(await keysFor(null)).not.toContain(FIXTURE_MODULE)
        expect(await keysFor(WS_ORDINARY)).toContain("sales")
        const shown = (await access.catalogFor("u-1", WS_ENTERPRISE)).modules
        expect(shown.map((module) => module.key)).toEqual(MODULE_CATALOG.map((module) => module.key))
        const fixture = shown.find((module) => module.key === FIXTURE_MODULE)
        expect(fixture?.plugin).toEqual({ key: "fixture", label: { vi: "Thu", en: "Fixture" } })
        expect(toModuleDefinitionType(fixture!).plugin).toEqual({ key: "fixture", label: { vi: "Thu", en: "Fixture" } })
        const sales = shown.find((module) => module.key === "sales")
        expect(toModuleDefinitionType(sales!).plugin).toEqual({ key: "core", label: { vi: "Nivo", en: "Nivo" } })
    })

    it("answers the not-found of an unknown key when a workspace that may not see the module reads it", async () => {
        const { access } = await world()
        await expect(access.findFor("u-1", FIXTURE_MODULE, WS_ORDINARY)).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        await expect(access.findFor("u-1", FIXTURE_MODULE, WS_OTHER)).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        await expect(access.findFor("u-1", FIXTURE_MODULE, null)).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        await expect(access.findFor("u-1", FIXTURE_MODULE, WS_ENTERPRISE)).resolves.toMatchObject({ key: FIXTURE_MODULE })
        await expect(access.findFor("u-1", "sales", null)).resolves.toMatchObject({ key: "sales" })
    })

    it("refuses the install door to an ordinary workspace and to another enterprise, and opens it to the matching one", async () => {
        const { install, installations } = await world()
        const request = (workspaceId: string) => ({
            workspaceId,
            moduleKey: FIXTURE_MODULE,
            locale: "vi" as const,
            name: null,
            newInstance: false,
        })
        await expect(install.install("u-1", request(WS_ORDINARY))).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        await expect(install.install("u-1", request(WS_OTHER))).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        expect(installations.firstOfModule).not.toHaveBeenCalled()
        installations.firstOfModule.mockResolvedValue({ id: "inst-1", agentId: "agent-1" } as never)
        await expect(install.install("u-1", request(WS_ENTERPRISE))).resolves.toEqual({
            installationId: "inst-1",
            agentId: "agent-1",
            created: false,
        })
    })

    it("lists and hands out the plugin's workflow templates to the matching enterprise workspace only", async () => {
        const { admin } = await world()
        const idsFor = async (workspaceId: string): Promise<ReadonlyArray<string>> =>
            (await admin.templates({ workspaceId, principalId: "u-1" }, { moduleKey: null, locale: "vi" })).map(
                (template) => template.id,
            )
        expect(await idsFor(WS_ORDINARY)).not.toContain(FIXTURE_PRIMARY.id)
        expect(await idsFor(WS_OTHER)).not.toContain(FIXTURE_SECONDARY.id)
        expect(await idsFor(WS_ORDINARY)).toContain("sales.consult")
        expect(await idsFor(WS_ENTERPRISE)).toEqual(expect.arrayContaining([FIXTURE_PRIMARY.id, FIXTURE_SECONDARY.id]))
        const one = (workspaceId: string) =>
            admin.template({ workspaceId, principalId: "u-1" }, { templateId: FIXTURE_SECONDARY.id, locale: "vi" })
        await expect(one(WS_ORDINARY)).rejects.toMatchObject({ code: AgentGraphsErrorCode.TemplateNotFound })
        await expect(one(WS_ENTERPRISE)).resolves.toMatchObject({ id: FIXTURE_SECONDARY.id })
    })

    it("seeds the module's primary graph and adopts its secondary template in the enterprise workspace, and refuses any other", async () => {
        const { seed, flows, workflows, workspaces, installations, adoption, rights } = await world()
        const text = JSON.stringify({ documents: [{ document: FIXTURE_PRIMARY.versions[0]?.graph }] })
        installations.firstOfModule.mockResolvedValue({ id: "inst-1", agentId: "agent-1", status: "live" } as never)
        workspaces.ownerIdOf.mockResolvedValue("owner-1")
        flows.holds.mockResolvedValue(true)
        workflows.seedAgent.mockResolvedValue(1)

        workspaces.list.mockResolvedValue([{ id: WS_ORDINARY, name: "Shop" }] as never)
        await expect(seed.run(text, "Shop")).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.InputInvalid })
        expect(workflows.seedAgent).not.toHaveBeenCalled()

        workspaces.list.mockResolvedValue([{ id: WS_ENTERPRISE, name: "Fixture Co" }] as never)
        await expect(seed.run(text, "Fixture Co")).resolves.toBeUndefined()
        expect(flows.holds).toHaveBeenCalledWith(WS_ENTERPRISE, "agent-1", expect.objectContaining({ moduleKey: FIXTURE_MODULE }))
        expect(workflows.seedAgent).toHaveBeenCalledWith(WS_ENTERPRISE, "agent-1", FIXTURE_MODULE)
        // The seeded agent is attached by the defaults its plugin declares (never a core list).
        expect(rights.insertMissing).toHaveBeenCalledWith(
            [expect.objectContaining({ agentId: "agent-1", provider: "zalo_oa", connectionId: "conn-zalo" })],
            null,
        )
        // What `seedAgent` adopts beside the primary graph: every other template of the module, read from the installation.
        await expect(adoption.missingTemplatesOf(WS_ENTERPRISE, "agent-1", FIXTURE_MODULE)).resolves.toEqual([FIXTURE_SECONDARY])
    })

    it("stops an installed private agent at its next step once the workspace no longer carries the identifier", async () => {
        const { policy, enterprise } = await world()
        const step = (workspaceId: string) => policy.toldOf(turnOf(workspaceId), FIXTURE_MODULE, "run-1:step")
        await expect(step(WS_ORDINARY)).rejects.toMatchObject({ code: AgentGraphsErrorCode.ModuleClosed })
        await expect(step(WS_OTHER)).rejects.toMatchObject({ code: AgentGraphsErrorCode.ModuleClosed })
        await expect(step(WS_ENTERPRISE)).resolves.toMatchObject({ guidance: `POLICY: ${FIXTURE_GUIDANCE.vi}` })
        await expect(enterprise.set(WS_ENTERPRISE, null)).resolves.toEqual({ from: FIXTURE_ENTERPRISE, to: null })
        await expect(step(WS_ENTERPRISE)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.ModuleClosed,
            params: { module: FIXTURE_MODULE },
        })
    })
})

describe("the enterprise identifier of a workspace", () => {
    it("is unique across workspaces, a lowercase slug, and unchanged by a refused write", async () => {
        const { enterprise, keys } = await world()
        await expect(enterprise.set(WS_OTHER, FIXTURE_ENTERPRISE)).rejects.toMatchObject({
            code: WorkspacesErrorCode.EnterpriseKeyTaken,
        })
        await expect(enterprise.set(WS_ORDINARY, "Not A Slug")).rejects.toMatchObject({
            code: WorkspacesErrorCode.EnterpriseKeyInvalid,
        })
        await expect(enterprise.set("44444444-4444-4444-8444-444444444444", "new-co")).rejects.toMatchObject({
            code: WorkspacesErrorCode.NotFound,
        })
        expect(keys.get(WS_OTHER)).toBe("other-co")
        expect(keys.get(WS_ORDINARY)).toBeNull()
        await expect(enterprise.set(WS_ENTERPRISE, FIXTURE_ENTERPRISE)).resolves.toEqual({
            from: FIXTURE_ENTERPRISE,
            to: FIXTURE_ENTERPRISE,
        })
        await expect(enterprise.keyOf(WS_ENTERPRISE)).resolves.toBe(FIXTURE_ENTERPRISE)
        await expect(enterprise.keyOf("44444444-4444-4444-8444-444444444444")).resolves.toBeNull()
    })

    it("is set and cleared by a platform admin only; a workspace owner changes nothing", async () => {
        const { adminEnterprise, keys, em } = await world()
        await expect(adminEnterprise.setEnterpriseKey(OWNER, WS_ORDINARY, FIXTURE_ENTERPRISE)).rejects.toMatchObject({
            code: PlatformAdminErrorCode.NotFound,
        })
        expect(em.update).not.toHaveBeenCalled()
        expect(keys.get(WS_ORDINARY)).toBeNull()
        await expect(adminEnterprise.setEnterpriseKey(ADMIN, WS_ORDINARY, "new-co")).resolves.toEqual({
            enterpriseKey: "new-co",
        })
        await expect(adminEnterprise.setEnterpriseKey(ADMIN, WS_ORDINARY, null)).resolves.toEqual({ enterpriseKey: null })
        expect(keys.get(WS_ORDINARY)).toBeNull()
    })
})
