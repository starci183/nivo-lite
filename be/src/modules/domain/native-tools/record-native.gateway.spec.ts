import { FakeClock, mock } from "@starci/jest-preset"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { ToolRegistryService } from "@modules/domain/tools"
import type { ToolCaller, ToolCallResult } from "@modules/domain/tools"
import { NativeRunnerService } from "@modules/domain/tools/native-runner.service"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import { ToolGrantsService } from "@modules/domain/tool-grants"
import type { Logger } from "@modules/platform/logging"
import type { QueueTimeout } from "@modules/platform/queue"
import { RECORD_TOOL } from "./record-native.names.policy"
import { RecordNativeService } from "./record-native.service"

/** A record type as a package declares it. */
const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: { title: field.text({ maxLength: 40 }) },
    indexes: [{ name: "by_title", on: ["title", "id"] }],
})

const WS = "11111111-1111-4111-8111-111111111111"

/** The engine's own caller with the step key a re-run of the same step passes again: a write needs no person's approval on it. */
const CALLER: ToolCaller = {
    workspaceId: WS,
    agentId: "agent-1",
    conversationId: null,
    workItemId: null,
    opKey: "run-1:step-1:d1",
    engine: true,
}

/** The record tools behind the real gateway, the durable receipt a claim per key (what `ToolReceiptsService` keeps in its table). */
const build = () => {
    const inserted: Array<RecordRow> = []
    const scopes: Array<string | null> = []
    const insert: EntitiesApi["insert"] = (entity, values) => {
        const row: RecordRow = {
            id: `0b9f1c2e-6d1a-4f0e-9a37-${String(inserted.length + 1).padStart(12, "0")}`,
            workspaceId: WS,
            version: "1",
            createdAt: "2026-11-13T00:00:00.000Z",
            updatedAt: "2026-11-13T00:00:00.000Z",
            data: { ...values, entity },
        }
        inserted.push(row)
        const result: EngineResult = { ok: true, row, version: row.version }
        return Promise.resolve(result)
    }
    const engine = mock<EntityEngineService>({ catalog: new Map<string, EntityDefinition>([[PROJECT.name, PROJECT]]) })
    engine.scoped.mockImplementation((workspaceId, work, agent) => {
        scopes.push(agent?.id ?? null)
        return work(mock<ScopedTx>({ workspaceId, ...(agent === undefined ? {} : { agent }) }))
    })
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockReturnValue(mock<EntitiesApi>({ insert }))
    const timeout = mock<QueueTimeout>()
    timeout.schedule.mockReturnValue(() => undefined)
    const toolGrants = mock<ToolGrantsService>()
    toolGrants.listOfAgent.mockResolvedValue([])
    const callLog = mock<ToolCallLogService>()
    callLog.append.mockResolvedValue(undefined)
    const receipts = mock<ToolReceiptsService>()
    const kept = new Map<string, Promise<ToolCallResult>>()
    receipts.run.mockImplementation((workspaceId, key, operation) => {
        const held = kept.get(`${workspaceId}:${key}`)
        if (held !== undefined) return held
        const result = operation()
        kept.set(`${workspaceId}:${key}`, result)
        return result
    })
    const gateway = new ToolRegistryService(
        { defaultTimeoutMs: 4000 },
        [new RecordNativeService(engine, ports)],
        new FakeClock("2026-11-13T00:00:00.000Z"),
        mock<Logger>(),
        toolGrants,
        callLog,
        receipts,
        new NativeRunnerService(timeout),
    )
    return { gateway, inserted, receipts, scopes }
}

describe("the record tools behind the gateway", () => {
    it("writes a replayed create once: the same step asking the same call again is answered the record it made", async () => {
        const { gateway, inserted, receipts, scopes } = build()
        const args = { type: PROJECT.name, values: { title: "Spring promo" } }
        const first = await gateway.call(CALLER, RECORD_TOOL.create, args)
        const again = await gateway.call(CALLER, RECORD_TOOL.create, args)
        expect(first).toMatchObject({ ok: true, value: { record: { values: { title: "Spring promo" } } } })
        expect(again).toEqual(first)
        expect(inserted).toHaveLength(1)
        expect(scopes).toEqual(["agent-1"])
        expect(receipts.run).toHaveBeenCalledTimes(2)
    })

    it("answers a refusal of the type's own declaration as the generic business refusal, with nothing written", async () => {
        const { gateway, inserted } = build()
        const refused = await gateway.call(CALLER, RECORD_TOOL.create, { type: PROJECT.name, values: { title: 7 } })
        expect(refused).toMatchObject({ ok: false, code: "tool_error", refused: "invalid_value" })
        expect(inserted).toHaveLength(0)
    })
})
