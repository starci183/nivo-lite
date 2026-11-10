import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService, ledgerKeyOf } from "./graph-node-effects.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-06T10:00:00.000Z"
const LOOKUP_SCOPE = cursorScopeOf("graph-nodes.effect", {}, "id")
const CALL = { key: "run:0", dedupeKey: null }

const recordedAs = (subjectEntity: unknown, subjectId: unknown, effectId = "core.send"): PageRow => ({
    row: {
        id: "e-1",
        workspaceId: WS,
        version: "1",
        createdAt: AT,
        updatedAt: AT,
        data: { effectId, subjectEntity, subjectId },
    },
    joined: {},
    position: ["e-1"],
    included: {},
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const logger = mock<Logger>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeEffectsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(GraphNodeEffectsService), engine, mutations, logger }
}

describe("ledgerKeyOf", () => {
    it("keys a call by its business key when it has one, else by the run step's own", () => {
        expect(ledgerKeyOf({ key: "run:0", dedupeKey: null })).toBe("call:run:0")
        expect(ledgerKeyOf({ key: "run:0", dedupeKey: "pay:o1" })).toBe("dedupe:pay:o1")
    })

    it("keeps a key too long for the ledger as its digest: the same call gives the same key, another call another", () => {
        const long = { key: `run:${"k".repeat(240)}`, dedupeKey: null }
        const key = ledgerKeyOf(long)
        expect(key).toMatch(/^digest:[0-9a-f]{64}$/)
        expect(ledgerKeyOf({ ...long })).toBe(key)
        expect(ledgerKeyOf({ key: `${long.key}x`, dedupeKey: null })).not.toBe(key)
    })
})

describe("GraphNodeEffectsService.once", () => {
    it("acts once and writes the subject under the key, outside the lookup's transaction", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs("message", "m-1").row, version: "1" })
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(service.once(WS, "core.send", CALL, act)).resolves.toEqual({ kind: "message", id: "m-1" })

        expect(act).toHaveBeenCalledTimes(1)
        expect(engine.scoped).toHaveBeenCalledTimes(2)
        expect(engine.list).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                from: "agent.node-effect",
                where: { op: "eq", field: "effectKey", value: "call:run:0" },
                page: { size: 1 },
            }),
            LOOKUP_SCOPE,
        )
        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            {
                op: "insert",
                entity: "agent.node-effect",
                values: { effectKey: "call:run:0", effectId: "core.send", subjectEntity: "message", subjectId: "m-1" },
            },
            "job",
        )
    })

    it("answers the first subject of a key already written and acts no more", async () => {
        const { service, engine, mutations, logger } = await build()
        engine.list.mockResolvedValue({ rows: [recordedAs("message", "m-0")], next: null })
        const act = jest.fn()

        await expect(service.once(WS, "core.send", { key: "run:0", dedupeKey: "pay:o1" }, act)).resolves.toEqual({
            kind: "message",
            id: "m-0",
        })

        expect(act).not.toHaveBeenCalled()
        expect(mutations.mutate).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith("graph_nodes.effect_replayed", {
            workspaceId: WS,
            effect: "core.send",
        })
    })

    it("never answers one effect with what another kept: a key another effect holds is refused before anything acts", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [recordedAs("message", "m-0", "customer.message.send")], next: null })
        const act = jest.fn()

        await expect(service.once(WS, "order.confirm", CALL, act)).rejects.toMatchObject({
            code: GraphNodesErrorCode.EffectKeyTaken,
            params: { effect: "order.confirm", heldBy: "customer.message.send" },
        })

        expect(act).not.toHaveBeenCalled()
        expect(mutations.mutate).not.toHaveBeenCalled()
    })

    it("answers the subject of the record that won when two runs raced to write the key", async () => {
        const { service, engine, mutations } = await build()
        engine.list
            .mockResolvedValueOnce({ rows: [], next: null })
            .mockResolvedValueOnce({ rows: [recordedAs("message", "m-0")], next: null })
        mutations.mutate.mockResolvedValue({
            ok: false,
            reason: "taken",
            constraint: "effect_key_key",
            refusal: "effect-already-recorded",
        })
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(service.once(WS, "core.send", CALL, act)).resolves.toEqual({ kind: "message", id: "m-0" })
    })
})

describe("GraphNodeEffectsService.once, when the act answers a refusal", () => {
    const REFUSED = { kind: "refused", id: "waits_owner", facts: { amountVnd: 5_000_000, thresholdVnd: 2_000_000 } }

    it("answers the refusal with its facts and writes nothing under the key: a refusal changed nothing", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        const act = jest.fn().mockResolvedValue(REFUSED)

        await expect(service.once(WS, "order.confirm", CALL, act)).resolves.toEqual(REFUSED)

        expect(act).toHaveBeenCalledTimes(1)
        expect(mutations.mutate).not.toHaveBeenCalled()
    })

    it("really makes the call again under the same key after a refusal, and keeps the subject of the call that went through", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs("order", "o-1").row, version: "1" })
        const act = jest.fn().mockResolvedValueOnce(REFUSED).mockResolvedValueOnce({ kind: "order", id: "o-1" })

        await expect(service.once(WS, "order.confirm", CALL, act)).resolves.toEqual(REFUSED)
        await expect(service.once(WS, "order.confirm", CALL, act)).resolves.toEqual({ kind: "order", id: "o-1" })

        expect(act).toHaveBeenCalledTimes(2)
        expect(mutations.mutate).toHaveBeenCalledTimes(1)
        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                values: { effectKey: "call:run:0", effectId: "order.confirm", subjectEntity: "order", subjectId: "o-1" },
            }),
            "job",
        )
    })
})

describe("GraphNodeEffectsService.once, when the ledger cannot answer", () => {
    it("fails when the key is neither written nor held by a winner, and when a record holds no subject", async () => {
        const { service, engine, mutations } = await build()
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: false, reason: "invalid" })

        await expect(service.once(WS, "core.send", CALL, act)).rejects.toMatchObject({
            code: GraphNodesErrorCode.EffectNotRecorded,
        })

        mutations.mutate.mockResolvedValue({
            ok: false,
            reason: "taken",
            constraint: "effect_key_key",
            refusal: "effect-already-recorded",
        })
        engine.list
            .mockResolvedValueOnce({ rows: [], next: null })
            .mockResolvedValueOnce({ rows: [recordedAs("message", 7)], next: null })
        await expect(service.once(WS, "core.send", CALL, act)).rejects.toMatchObject({
            code: GraphNodesErrorCode.EffectNotRecorded,
        })
    })
})
