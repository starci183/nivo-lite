import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { WorkspacesService } from "@modules/domain/workspaces"
import { RecordsSeedService } from "./records-seed.service"
import { RECORDS_SEED_SCHEMA } from "./records-seed.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"

const RECORD = { entity: "sales.settings", on: "key_key", values: { key: "sales", maxDiscountPct: 10 } }
const TEXT = `${JSON.stringify({ documents: [{ path: "data/records.json", document: { schema: RECORDS_SEED_SCHEMA, records: [RECORD] } }] })}\n`
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
    const list = mock<WorkspacesService>()
    list.list.mockResolvedValue(workspaces)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordsSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: WorkspacesService, useValue: list },
        ],
    }).compile()
    return { service: moduleRef.get(RecordsSeedService), engine, mutations, tx, print }
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
