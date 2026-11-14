import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import {
    EntityEngineError,
    EntityEngineErrorCode,
    EntityEngineService,
    EntityMutationService,
    ModuleAgentService,
} from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { WorkspacesService } from "@modules/domain/workspaces"
import { RecordsSeedService } from "./records-seed.service"
import { RECORDS_SEED_SCHEMA } from "./records-seed.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"

const RECORD = { entity: "sales.settings", on: "key_key", values: { key: "sales", maxDiscountPct: 10 } }
const textOf = (records: ReadonlyArray<{ readonly entity: string; readonly on: string; readonly values: object }>) =>
    `${JSON.stringify({ documents: [{ path: "data/records.json", document: { schema: RECORDS_SEED_SCHEMA, records } }] })}\n`
const TEXT = textOf([RECORD])
const AGENT = { id: "agent-sales", sees: "all" } as const
const WORKSPACE_ID = "6f1c2a52-0000-4000-8000-000000000001"

const build = async (
    workspaces: ReadonlyArray<{ id: string; name: string }> = [{ id: WORKSPACE_ID, name: "NIVO" }],
) => {
    const tx = mock<ScopedTx>()
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspaceId, work) => work(tx))
    const mutations = mock<EntityMutationService>()
    mutations.mutate.mockResolvedValue({
        ok: true,
        row: { id: "record-1", workspaceId: WORKSPACE_ID, version: "1", createdAt: "", updatedAt: "", data: {} },
        version: "1",
    })
    const agents = mock<ModuleAgentService>()
    agents.scopeOf.mockResolvedValue(AGENT)
    const list = mock<WorkspacesService>()
    list.list.mockResolvedValue(workspaces)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordsSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: ModuleAgentService, useValue: agents },
            { provide: WorkspacesService, useValue: list },
        ],
    }).compile()
    return { service: moduleRef.get(RecordsSeedService), engine, mutations, agents, tx, print }
}

describe("RecordsSeedService > run", () => {
    it("upserts each record in the scope of the named workspace and prints it without a value", async () => {
        const { service, engine, mutations, tx, print } = await build()

        await service.run(TEXT, "NIVO")

        expect(engine.scoped.mock.calls.map(([workspaceId]) => workspaceId)).toEqual([WORKSPACE_ID])
        expect(mutations.mutate.mock.calls).toEqual([
            [tx, { op: "upsert", entity: "sales.settings", on: "key_key", values: RECORD.values }, "job"],
        ])
        expect(print.mock.calls).toEqual([["records sales.settings saved"]])
    })

    it("writes each record for the installed agent of the module its entity belongs to", async () => {
        const { service, engine, agents } = await build()
        const hiring = { entity: "hiring.settings", on: "key_key", values: { key: "hiring" } }
        agents.scopeOf.mockImplementation((_workspaceId, module) =>
            Promise.resolve(module === "hiring" ? { id: "agent-hiring", sees: "all" as const } : AGENT),
        )

        await service.run(textOf([RECORD, hiring, RECORD]), "NIVO")

        expect(agents.scopeOf.mock.calls).toEqual([
            [WORKSPACE_ID, "sales"],
            [WORKSPACE_ID, "hiring"],
        ])
        expect(engine.scoped.mock.calls.map(([, , agent]) => agent?.id)).toEqual([
            "agent-sales",
            "agent-hiring",
            "agent-sales",
        ])
    })

    it("reads the module of a package-qualified entity as its agent part and of an old-form entity as its first part", async () => {
        const { service, agents } = await build()
        const qualified = { entity: "blocks-core.hiring.job", on: "key_key", values: { key: "hiring" } }
        const old = { entity: "loyalty.member", on: "key_key", values: { key: "loyalty" } }

        await service.run(textOf([qualified, old]), "NIVO")

        expect(agents.scopeOf.mock.calls).toEqual([
            [WORKSPACE_ID, "hiring"],
            [WORKSPACE_ID, "loyalty"],
        ])
    })

    it("refuses the whole run before it writes anything when a module has no installed agent", async () => {
        const { service, engine, mutations, agents } = await build()
        agents.scopeOf.mockRejectedValue(new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing }))

        await expect(service.run(TEXT, "NIVO")).rejects.toMatchObject({ code: EntityEngineErrorCode.AgentMissing })

        expect(engine.scoped).not.toHaveBeenCalled()
        expect(mutations.mutate).not.toHaveBeenCalled()
    })

    it("refuses a record the engine does not take, by its entity", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValue({ ok: false, reason: "invalid" })

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(
            new ConnectionsError({
                code: ConnectionsErrorCode.CommandInvalid,
                params: { field: "record.sales.settings" },
            }),
        )
    })

    it.each([
        ["no workspace of that name", []],
        [
            "two workspaces of that name",
            [
                { id: WORKSPACE_ID, name: "NIVO" },
                { id: "6f1c2a52-0000-4000-8000-000000000002", name: "NIVO" },
            ],
        ],
    ])("refuses %s before it writes anything", async (_name, workspaces) => {
        const { service, engine } = await build(workspaces)

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "workspace" } }),
        )

        expect(engine.scoped).not.toHaveBeenCalled()
    })
})
