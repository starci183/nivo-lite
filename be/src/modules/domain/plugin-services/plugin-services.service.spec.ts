import { Test } from "@nestjs/testing"
import { builder, fakeIds, fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    EntityEngineService,
    EntityMutationService,
    EntityPortsService,
    ListSourceService,
    ModuleAgentService,
    EntityEngineErrorCode,
    EntityEngineError,
    type ScopedTx,
} from "@modules/domain/entity-engine"
import { EngineFailureService } from "@modules/domain/entity-engine/engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "@modules/domain/entity-engine/entity-engine.decorators"
import type { EntityEngineOptions } from "@modules/domain/entity-engine/entity-engine.options"
import { mintScopedTx } from "@modules/domain/entity-engine/policies/scoped-tx.policy"
import { RecordEntity } from "@modules/domain/entity-engine/persistence/entities"
import { installedPluginsOf } from "@modules/domain/installed-plugins/installed-plugins.policy"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { DoorPortsService } from "@modules/domain/workbench-door/door-ports.service"
import { WORKBENCH_DOOR_OPTIONS } from "@modules/domain/workbench-door/workbench-door.decorators"
import type { WorkbenchDoorOptions } from "@modules/domain/workbench-door/workbench-door.options"
import { MemberLookupService } from "@modules/domain/workspace-members"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"
import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { ENTITIES_PORT, type EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { defineService, defineServiceContract } from "@nivo-lite/agent-sdk/service"
import { PLUGIN_SERVICES_OPTIONS, PLUGIN_SERVICE_PORTS } from "./plugin-services.decorators"
import { PluginServicesError, PluginServicesErrorCode } from "./errors/plugin-services.error"
import { PluginServicesService } from "./plugin-services.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "44444444-4444-4444-8444-444444444444"
const OTHER_AGENT = "55555555-5555-4555-8555-555555555555"
const BARE_AGENT = "66666666-6666-4666-8666-666666666666"
const GONE_AGENT = "77777777-7777-4777-8777-777777777777"
const NOTE_ID = "00000000-0000-4000-8000-000000000001"
const AT = new Date("2026-11-13T10:00:00.000Z")
const SCOPE_SQL = 'SELECT * FROM "public"."engine_scope_enter"($1)'

const NOTE: EntityDefinition = {
    entry: "entity",
    name: "fixpkg.chat.note",
    dataKind: "fixpkg-note",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
}

/** What the engine knows of the fixture service: a note store. */
interface NoteStore {
    readonly add: (title: string) => Promise<string>
    readonly find: (id: string) => Promise<boolean>
    readonly context: () => RunContext
}

const NOTE_STORE = defineServiceContract<NoteStore>("engine.note-store")
const AUDIT = defineServiceContract<{ readonly ping: () => string }>("engine.audit")

/** The fixture plugin's service: a note store over the entities port, owned by the `chat` module. */
const CHAT_NOTES = defineService({
    id: "fixpkg.chat.note-store",
    contract: NOTE_STORE,
    moduleKey: "chat",
    ports: { entities: ENTITIES_PORT },
    build: (ports: { readonly entities: EntitiesApi }, context): NoteStore => ({
        add: async (title) => {
            const result = await ports.entities.insert(NOTE.name, { title })
            if (!result.ok) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `insert refused: ${result.reason}` } })
            return result.row.id
        },
        find: async (id) => (await ports.entities.get(NOTE.name, id)) !== null,
        context: () => context,
    }),
})

const INSTALLED = installedPluginsOf(defineInstallation([{ services: [CHAT_NOTES] }], "hash"))

const installation = (moduleKey: string, agentId: string, status: InstallationRecord["status"] = "live"): InstallationRecord =>
    builder<InstallationRecord>({
        id: "inst-1",
        workspaceId: WS,
        moduleKey,
        name: moduleKey,
        isMulti: false,
        agentId,
        status,
        operatingMode: "assist",
        liveEnabled: true,
        activeContextVersionId: "version-1",
        settings: {},
        createdAt: "2026-10-01T00:00:00.000Z",
    })()

const rawRecord = (id: string) => ({
    id,
    workspace_id: WS,
    version: "1",
    created_at: AT,
    updated_at: AT,
    data: { title: "hello" },
})

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    em.query.mockResolvedValue([])
    const installations = mock<InstallationRecordsService>()
    installations.ofAgent.mockImplementation((_workspaceId, agentId) => {
        if (agentId === AGENT || agentId === OTHER_AGENT) return Promise.resolve(installation("chat", agentId))
        if (agentId === BARE_AGENT) return Promise.resolve(installation("audit", agentId))
        if (agentId === GONE_AGENT) return Promise.resolve(installation("chat", agentId, "removed"))
        return Promise.resolve(null)
    })
    const agents = mock<ModuleAgentService>()
    const zones = mock<WorkspaceTimeZoneService>()
    zones.timeZoneOf.mockResolvedValue("Asia/Ho_Chi_Minh")
    const failures = mock<EngineFailureService>()
    failures.reading.mockImplementation((_entity, work) => work())
    const entityOptions = builder<EntityEngineOptions>({ entities: [NOTE], jobs: [], cursorKey: new Secret(Buffer.alloc(32, 5).toString("base64")) })()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PluginServicesService,
            DoorPortsService,
            { provide: PLUGIN_SERVICE_PORTS, useExisting: DoorPortsService },
            EntityEngineService,
            EntityPortsService,
            EntityMutationService,
            { provide: PLUGIN_SERVICES_OPTIONS, useValue: { catalog: INSTALLED } },
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: builder<WorkbenchDoorOptions>({ modules: [], entities: [NOTE], registryHash: "h" })() },
            { provide: ENTITY_ENGINE_OPTIONS, useValue: entityOptions },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: IDS, useValue: fakeIds() },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModuleAgentService, useValue: agents },
            { provide: WorkspaceTimeZoneService, useValue: zones },
            { provide: EngineFailureService, useValue: failures },
            { provide: ListSourceService, useValue: mock<ListSourceService>() },
            { provide: MemberLookupService, useValue: mock<MemberLookupService>() },
            { provide: ModuleJobsQueue, useValue: mock<ModuleJobsQueue>() },
        ],
    }).compile()
    return {
        services: moduleRef.get(PluginServicesService),
        engine: moduleRef.get(EntityEngineService),
        agents,
        installations,
        em,
    }
}

const fresh = () => build(mockEntityManager({ query: [SCOPE_SQL, []] }))

/** The error a promise rejects with. */
const rejection = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
    } catch (error) {
        return error
    }
    return undefined
}

describe("PluginServicesService.of", () => {
    it("builds the service the agent's module ships, with the run context of the scope", async () => {
        const { services } = await fresh()

        const store = await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT, memberId: "m1", locale: "en" })

        expect(store.context()).toEqual({ workspaceId: WS, memberId: "m1", now: AT, timeZone: "Asia/Ho_Chi_Minh", locale: "en" })
        const plain = await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT })
        expect(plain.context()).toMatchObject({ memberId: null, locale: "vi" })
    })

    it("stamps a record the service writes with the agent of the scope, in the workspace's engine scope (never AgentMissing)", async () => {
        const { services, em } = await fresh()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NOTE_ID)] } }])

        const store = await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT })

        await expect(store.add("hello")).resolves.toBe(NOTE_ID)
        expect(em.query).toHaveBeenCalledWith(SCOPE_SQL, [WS])
        expect(insert?.callsOf("values")).toEqual([
            [{ id: NOTE_ID, workspaceId: WS, entity: NOTE.name, agentId: AGENT, data: expect.any(Function) }],
        ])
    })

    it("stamps the agent the scope names and no other: the same service for another agent writes that agent's record", async () => {
        const { services, em } = await fresh()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NOTE_ID)] } }])

        await (await services.of(NOTE_STORE, { workspaceId: WS, agentId: OTHER_AGENT })).add("hello")

        expect(insert?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: OTHER_AGENT })]])
    })

    it("confines the service's reads to the agent's own records by default, and to the workspace's when the scope says `all`", async () => {
        const { services, em } = await fresh()
        em.findOne.mockResolvedValue(null)

        await (await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT })).find(NOTE_ID)
        await (await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT, sees: "all" })).find(NOTE_ID)

        expect(em.findOne.mock.calls).toEqual([
            [RecordEntity, { where: { entity: NOTE.name, id: NOTE_ID, workspaceId: WS, agentId: AGENT } }],
            [RecordEntity, { where: { entity: NOTE.name, id: NOTE_ID, workspaceId: WS } }],
        ])
    })

    it("refuses an agent that is no installed agent of the workspace, or whose installation was removed", async () => {
        const { services } = await fresh()

        for (const agentId of ["88888888-8888-4888-8888-888888888888", GONE_AGENT]) {
            const error = await rejection(services.of(NOTE_STORE, { workspaceId: WS, agentId }))
            expect(error).toBeInstanceOf(PluginServicesError)
            expect(error).toMatchObject({ code: PluginServicesErrorCode.AgentUnknown, params: { agentId, workspaceId: WS } })
        }
    })

    it("refuses with a typed error when no installed plugin ships the contract for the agent's module", async () => {
        const { services } = await fresh()

        await expect(services.of(AUDIT, { workspaceId: WS, agentId: AGENT })).rejects.toMatchObject({
            code: PluginServicesErrorCode.ServiceMissing,
            params: { contract: "engine.audit", module: "chat" },
        })
        await expect(services.of(NOTE_STORE, { workspaceId: WS, agentId: BARE_AGENT })).rejects.toMatchObject({
            code: PluginServicesErrorCode.ServiceMissing,
            params: { contract: "engine.note-store", module: "audit" },
        })
    })
})

describe("PluginServicesService.of with the caller's transaction", () => {
    it("runs the service's writes in the transaction the caller holds: one transaction, one scope entry, stamped with the agent", async () => {
        const { services, engine, em } = await fresh()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NOTE_ID)] } }])

        const id = await engine.scoped(
            WS,
            async (tx) => (await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT, transaction: tx })).add("hello"),
            { id: AGENT, sees: "all" },
        )

        expect(id).toBe(NOTE_ID)
        expect(em.transaction).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(insert?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: AGENT })]])
    })

    it("lets the caller's rights decide what is read: the caller's `all` scope is kept, not narrowed to `own`", async () => {
        const { services, engine, em } = await fresh()
        em.findOne.mockResolvedValue(null)

        await engine.scoped(
            WS,
            async (tx) => (await services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT, transaction: tx })).find(NOTE_ID),
            { id: AGENT, sees: "all" },
        )

        expect(em.findOne).toHaveBeenCalledWith(RecordEntity, { where: { entity: NOTE.name, id: NOTE_ID, workspaceId: WS } })
    })

    it("refuses, before any statement, a transaction that acts for no agent or for another agent, or is of another workspace", async () => {
        const { services, em } = await fresh()
        const txOf = (workspaceId: string, agentId?: string): ScopedTx =>
            mintScopedTx({ manager: em, workspaceId, ...(agentId === undefined ? {} : { agent: { id: agentId, sees: "all" } }) })
        const mismatches = [txOf(WS), txOf(WS, OTHER_AGENT), txOf("99999999-9999-4999-8999-999999999999", AGENT)]

        for (const transaction of mismatches) {
            const error = await rejection(services.of(NOTE_STORE, { workspaceId: WS, agentId: AGENT, transaction }))
            expect(error).toMatchObject({ code: PluginServicesErrorCode.ScopeMismatch, params: { workspaceId: WS, agentId: AGENT } })
        }
        expect(em.query).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("PluginServicesService.within", () => {
    it("runs every call of the callback in ONE new transaction scoped to the agent", async () => {
        const { services, em } = await fresh()
        const [first, second] = queueQueryBuilders(em, [
            { execute: { raw: [rawRecord(NOTE_ID)] } },
            { execute: { raw: [rawRecord(NOTE_ID)] } },
        ])

        const ids = await services.within(NOTE_STORE, { workspaceId: WS, agentId: AGENT }, async (store, transaction) => {
            expect(transaction).toMatchObject({ workspaceId: WS, agent: { id: AGENT, sees: "own" } })
            return [await store.add("one"), await store.add("two")]
        })

        expect(ids).toEqual([NOTE_ID, NOTE_ID])
        expect(em.transaction).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(first?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: AGENT })]])
        expect(second?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: AGENT })]])
    })

    it("opens no transaction for an agent whose module ships no such service", async () => {
        const { services, em } = await fresh()

        await expect(services.within(AUDIT, { workspaceId: WS, agentId: AGENT }, () => Promise.resolve(1))).rejects.toMatchObject({
            code: PluginServicesErrorCode.ServiceMissing,
        })
        expect(em.transaction).not.toHaveBeenCalled()
    })
})

describe("PluginServicesService.forModule", () => {
    it("derives the agent the way ModuleAgentService.scopeOf does, then builds that agent's service", async () => {
        const { services, agents, em } = await fresh()
        agents.scopeOf.mockResolvedValue({ id: AGENT, sees: "all" })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NOTE_ID)] } }])

        const store = await services.forModule(NOTE_STORE, { workspaceId: WS, moduleKey: "chat", installationId: "inst-1" })
        await store.add("hello")

        expect(agents.scopeOf).toHaveBeenCalledWith(WS, "chat", "inst-1")
        expect(insert?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: AGENT })]])
    })

    it("passes on the refusal of a module with no installed agent", async () => {
        const { services, agents } = await fresh()
        agents.scopeOf.mockRejectedValue(new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing, params: { module: "chat" } }))

        await expect(services.forModule(NOTE_STORE, { workspaceId: WS, moduleKey: "chat" })).rejects.toMatchObject({
            code: EntityEngineErrorCode.AgentMissing,
        })
    })
})

describe("PluginServicesService.withinContract", () => {
    it("finds the module that ships the contract and runs the service in ONE transaction as that module's agent, seeing the workspace", async () => {
        const { services, agents, em } = await fresh()
        agents.scopeOf.mockResolvedValue({ id: AGENT, sees: "own" })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NOTE_ID)] } }])

        const id = await services.withinContract(NOTE_STORE, { workspaceId: WS }, async (store, transaction) => {
            expect(transaction).toMatchObject({ workspaceId: WS, agent: { id: AGENT, sees: "all" } })
            return await store.add("hello")
        })

        expect(id).toBe(NOTE_ID)
        expect(agents.scopeOf).toHaveBeenCalledWith(WS, "chat")
        expect(em.transaction).toHaveBeenCalledTimes(1)
        expect(insert?.callsOf("values")).toEqual([[expect.objectContaining({ agentId: AGENT })]])
    })

    it("names the module of a contract, null for a contract no installed plugin ships, and refuses such a contract with a typed error", async () => {
        const { services, agents } = await fresh()

        expect(services.moduleKeyOf(NOTE_STORE)).toBe("chat")
        expect(services.moduleKeyOf(AUDIT)).toBeNull()
        await expect(services.withinContract(AUDIT, { workspaceId: WS }, () => Promise.resolve(1))).rejects.toMatchObject({
            code: PluginServicesErrorCode.ServiceMissing,
        })
        expect(agents.scopeOf).not.toHaveBeenCalled()
    })

    it("passes on the refusal of a module with no installed agent", async () => {
        const { services, agents } = await fresh()
        agents.scopeOf.mockRejectedValue(new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing, params: { module: "chat" } }))

        await expect(services.withinContract(NOTE_STORE, { workspaceId: WS }, () => Promise.resolve(1))).rejects.toMatchObject({
            code: EntityEngineErrorCode.AgentMissing,
        })
    })
})
