import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import {
    GraphNodeEffectsService,
    OUTCOME_UNKNOWN_CODES,
    OUTCOME_UNKNOWN_KIND,
    ledgerJsonOf,
    ledgerKeyOf,
    placeOf,
} from "./graph-node-effects.service"

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
        engine.list.mockResolvedValue({ rows: [recordedAs("message", "m-0", "nivo.lead.message.send")], next: null })
        const act = jest.fn()

        await expect(service.once(WS, "nivo.order.confirm", CALL, act)).rejects.toMatchObject({
            code: GraphNodesErrorCode.EffectKeyTaken,
            params: { effect: "nivo.order.confirm", heldBy: "nivo.lead.message.send" },
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

        await expect(service.once(WS, "nivo.order.confirm", CALL, act)).resolves.toEqual(REFUSED)

        expect(act).toHaveBeenCalledTimes(1)
        expect(mutations.mutate).not.toHaveBeenCalled()
    })

    it("really makes the call again under the same key after a refusal, and keeps the subject of the call that went through", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs("order", "o-1").row, version: "1" })
        const act = jest.fn().mockResolvedValueOnce(REFUSED).mockResolvedValueOnce({ kind: "order", id: "o-1" })

        await expect(service.once(WS, "nivo.order.confirm", CALL, act)).resolves.toEqual(REFUSED)
        await expect(service.once(WS, "nivo.order.confirm", CALL, act)).resolves.toEqual({ kind: "order", id: "o-1" })

        expect(act).toHaveBeenCalledTimes(2)
        expect(mutations.mutate).toHaveBeenCalledTimes(1)
        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                values: { effectKey: "call:run:0", effectId: "nivo.order.confirm", subjectEntity: "order", subjectId: "o-1" },
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

const RUN = "0f8e2c1a-5b6d-4e7f-8a9b-0c1d2e3f4a5b"
const STEP_CALL = { key: `${RUN}:answer:0123456789abcdef`, dedupeKey: null }

describe("placeOf", () => {
    it("reads the run and the step of a step's call key, an undo's key, and nothing of another key", () => {
        expect(placeOf(STEP_CALL.key)).toEqual({ runId: RUN, stepKey: "answer" })
        expect(placeOf(`${RUN}:loop:item:0123456789abcdef`)).toEqual({ runId: RUN, stepKey: "loop:item" })
        expect(placeOf(`${RUN}:order:undo:2`)).toEqual({ runId: RUN, stepKey: "order" })
        expect(placeOf("mcp:agent-1:op-7")).toBeNull()
        expect(placeOf("run:0")).toBeNull()
    })
})

describe("ledgerJsonOf", () => {
    it("keeps plain JSON within the ledger's bounds, and leaves out what it cannot hold", () => {
        expect(ledgerJsonOf({ text: "Da nhan", at: new Date(AT), skip: undefined })).toEqual({ text: "Da nhan", at: AT })
        expect(ledgerJsonOf(undefined)).toBeNull()
        expect(ledgerJsonOf(["a"])).toBeNull()
        expect(ledgerJsonOf({ text: "x".repeat(20_001) })).toBeNull()
        expect(ledgerJsonOf({ big: BigInt(1) })).toBeNull()
    })
})

describe("GraphNodeEffectsService.once, D.1: the run, the step, the arguments and the facts of each call", () => {
    it("keeps them beside the subject, the place read from the step's call key", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs("message", "m-1").row, version: "1" })
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1", facts: { conversationId: "c-1" } })

        await service.once(WS, "nivo.lead.message.send", STEP_CALL, act, { args: { conversationId: "c-1", text: "Da nhan" } })

        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                values: {
                    effectKey: `call:${STEP_CALL.key}`,
                    effectId: "nivo.lead.message.send",
                    runId: RUN,
                    stepKey: "answer",
                    args: { conversationId: "c-1", text: "Da nhan" },
                    subjectEntity: "message",
                    subjectId: "m-1",
                    facts: { conversationId: "c-1" },
                },
            }),
            "job",
        )
    })

    it("takes the place its caller names over the key's", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs("message", "m-1").row, version: "1" })

        await service.once(WS, "core.send", CALL, jest.fn().mockResolvedValue({ kind: "message", id: "m-1" }), {
            place: { runId: RUN, stepKey: "match" },
        })

        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                values: {
                    effectKey: "call:run:0",
                    effectId: "core.send",
                    runId: RUN,
                    stepKey: "match",
                    subjectEntity: "message",
                    subjectId: "m-1",
                },
            }),
            "job",
        )
    })

    it("answers a replay with the facts the first call answered, not the subject alone", async () => {
        const { service, engine } = await build()
        const kept = recordedAs("order", "o-1", "nivo.order.confirm")
        engine.list.mockResolvedValue({
            rows: [{ ...kept, row: { ...kept.row, data: { ...kept.row.data, facts: { totalVnd: 100_000 } } } }],
            next: null,
        })

        await expect(service.once(WS, "nivo.order.confirm", CALL, jest.fn())).resolves.toEqual({
            kind: "order",
            id: "o-1",
            facts: { totalVnd: 100_000 },
        })
    })
})

describe("GraphNodeEffectsService.once, an outcome nobody knows", () => {
    const unknown = (code: string): Error => Object.assign(new Error("sent, no answer"), { code })

    it.each([...OUTCOME_UNKNOWN_CODES])("keeps a call that ended with %s and rethrows it untouched", async (code: string) => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        mutations.mutate.mockResolvedValue({ ok: true, row: recordedAs(OUTCOME_UNKNOWN_KIND, code).row, version: "1" })
        const thrown = unknown(code)

        await expect(service.once(WS, "nivo.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(thrown))).rejects.toBe(thrown)

        expect(mutations.mutate).toHaveBeenCalledWith(
            expect.anything(),
            {
                op: "insert",
                entity: "agent.node-effect",
                values: {
                    effectKey: `call:${STEP_CALL.key}`,
                    effectId: "nivo.agent.tag",
                    runId: RUN,
                    stepKey: "answer",
                    subjectEntity: OUTCOME_UNKNOWN_KIND,
                    subjectId: code,
                    facts: { code },
                },
            },
            "job",
        )
    })

    it("never makes such a call again: the key answers the same code, nothing acts", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({
            rows: [recordedAs(OUTCOME_UNKNOWN_KIND, "tool_outcome_unknown", "nivo.agent.tag")],
            next: null,
        })
        const act = jest.fn()

        await expect(service.once(WS, "nivo.agent.tag", STEP_CALL, act)).rejects.toMatchObject({ code: "tool_outcome_unknown" })

        expect(act).not.toHaveBeenCalled()
        expect(mutations.mutate).not.toHaveBeenCalled()
    })

    it("keeps nothing for any other throw (the call may be made again, as before); a failed keep never hides the act's error", async () => {
        const { service, engine, mutations } = await build()
        engine.list.mockResolvedValue({ rows: [], next: null })
        const other = Object.assign(new Error("refused"), { code: "provider_down" })

        await expect(service.once(WS, "nivo.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(other))).rejects.toBe(other)
        expect(mutations.mutate).not.toHaveBeenCalled()

        mutations.mutate.mockRejectedValue(new Error("db down"))
        const thrown = unknown("tool_outcome_unknown")
        await expect(service.once(WS, "nivo.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(thrown))).rejects.toBe(thrown)
    })
})

describe("GraphNodeEffectsService.recordsOf", () => {
    it("reads a run step's records by run and step, oldest first, cut to the effects named, with their arguments and time", async () => {
        const { service, engine } = await build()
        const send = recordedAs("message", "m-1", "nivo.lead.message.send")
        const post = recordedAs("team-message", "t-1", "nivo.team.message.post")
        const args = { conversationId: "c-1", text: "Da nhan" }
        engine.list.mockResolvedValue({
            rows: [{ ...send, row: { ...send.row, data: { ...send.row.data, args } } }, post],
            next: null,
        })

        await expect(service.recordsOf(WS, { runId: RUN, stepKey: "match" }, ["nivo.lead.message.send"])).resolves.toEqual([
            { effect: "nivo.lead.message.send", args, subject: { kind: "message", id: "m-1" }, at: AT },
        ])
        expect(engine.list).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                from: "agent.node-effect",
                where: {
                    op: "and",
                    of: [
                        { op: "eq", field: "runId", value: RUN },
                        { op: "eq", field: "stepKey", value: "match" },
                    ],
                },
                order: [["id", "asc"]],
            }),
            cursorScopeOf("graph-nodes.effect-step", {}, "id"),
        )
    })
})
