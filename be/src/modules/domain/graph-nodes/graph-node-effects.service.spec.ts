import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
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
import { NODE_EFFECT_STORE, type NodeEffectStore, type StoredEffect } from "./node-effect-store.port"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-06T10:00:00.000Z"
const CALL = { key: "run:0", dedupeKey: null }

/** A ledger row as the store answers it: the effect that wrote the key and the subject it kept. */
const recordedAs = (subjectEntity: string, subjectId: string, effectId = "core.send", more: Partial<StoredEffect> = {}): StoredEffect => ({
    effectKey: "call:run:0",
    effectId,
    subjectEntity,
    subjectId,
    undoneAt: null,
    runId: null,
    stepKey: null,
    args: null,
    facts: null,
    createdAt: AT,
    ...more,
})

const build = async () => {
    const store = mock<NodeEffectStore>()
    const logger = mock<Logger>()
    store.byKey.mockResolvedValue(null)
    store.insert.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeEffectsService,
            { provide: NODE_EFFECT_STORE, useValue: store },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(GraphNodeEffectsService), store, logger }
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
    it("acts once and writes the subject under the key, after the lookup and outside any transaction", async () => {
        const { service, store } = await build()
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(service.once(WS, "core.send", CALL, act)).resolves.toEqual({ kind: "message", id: "m-1" })

        expect(act).toHaveBeenCalledTimes(1)
        expect(store.byKey).toHaveBeenCalledWith(WS, "call:run:0")
        expect(store.insert).toHaveBeenCalledWith(WS, {
            effectKey: "call:run:0",
            effectId: "core.send",
            runId: null,
            stepKey: null,
            args: null,
            subjectEntity: "message",
            subjectId: "m-1",
            facts: null,
        })
    })

    it("answers the first subject of a key already written and acts no more", async () => {
        const { service, store, logger } = await build()
        store.byKey.mockResolvedValue(recordedAs("message", "m-0"))
        const act = jest.fn()

        await expect(service.once(WS, "core.send", { key: "run:0", dedupeKey: "pay:o1" }, act)).resolves.toEqual({
            kind: "message",
            id: "m-0",
        })

        expect(act).not.toHaveBeenCalled()
        expect(store.insert).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith("graph_nodes.effect_replayed", {
            workspaceId: WS,
            effect: "core.send",
        })
    })

    it("never answers one effect with what another kept: a key another effect holds is refused before anything acts", async () => {
        const { service, store } = await build()
        store.byKey.mockResolvedValue(recordedAs("message", "m-0", "nivo.tool.customer.message.send"))
        const act = jest.fn()

        await expect(service.once(WS, "nivo.tool.order.confirm", CALL, act)).rejects.toMatchObject({
            code: GraphNodesErrorCode.EffectKeyTaken,
            params: { effect: "nivo.tool.order.confirm", heldBy: "nivo.tool.customer.message.send" },
        })

        expect(act).not.toHaveBeenCalled()
        expect(store.insert).not.toHaveBeenCalled()
    })

    it("answers the subject of the record that won when two runs raced to write the key", async () => {
        const { service, store } = await build()
        store.byKey.mockResolvedValueOnce(null).mockResolvedValueOnce(recordedAs("message", "m-0"))
        store.insert.mockResolvedValue(false)
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(service.once(WS, "core.send", CALL, act)).resolves.toEqual({ kind: "message", id: "m-0" })
    })
})

describe("GraphNodeEffectsService.once, when the act answers a refusal", () => {
    const REFUSED = { kind: "refused", id: "needs_owner_note", facts: { amountVnd: 5_000_000, thresholdVnd: 2_000_000 } }

    it("answers the refusal with its facts and writes nothing under the key: a refusal changed nothing", async () => {
        const { service, store } = await build()
        const act = jest.fn().mockResolvedValue(REFUSED)

        await expect(service.once(WS, "nivo.tool.order.confirm", CALL, act)).resolves.toEqual(REFUSED)

        expect(act).toHaveBeenCalledTimes(1)
        expect(store.insert).not.toHaveBeenCalled()
    })

    it("really makes the call again under the same key after a refusal, and keeps the subject of the call that went through", async () => {
        const { service, store } = await build()
        const act = jest.fn().mockResolvedValueOnce(REFUSED).mockResolvedValueOnce({ kind: "order", id: "o-1" })

        await expect(service.once(WS, "nivo.tool.order.confirm", CALL, act)).resolves.toEqual(REFUSED)
        await expect(service.once(WS, "nivo.tool.order.confirm", CALL, act)).resolves.toEqual({ kind: "order", id: "o-1" })

        expect(act).toHaveBeenCalledTimes(2)
        expect(store.insert).toHaveBeenCalledTimes(1)
        expect(store.insert).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ effectKey: "call:run:0", effectId: "nivo.tool.order.confirm", subjectEntity: "order", subjectId: "o-1" }),
        )
    })
})

describe("GraphNodeEffectsService.once, when the ledger cannot answer", () => {
    it("fails when the key is neither written nor held by a winner", async () => {
        const { service, store } = await build()
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1" })
        store.insert.mockResolvedValue(false)

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
        const { service, store } = await build()
        const act = jest.fn().mockResolvedValue({ kind: "message", id: "m-1", facts: { conversationId: "c-1" } })

        await service.once(WS, "nivo.tool.customer.message.send", STEP_CALL, act, { args: { conversationId: "c-1", text: "Da nhan" } })

        expect(store.insert).toHaveBeenCalledWith(WS, {
            effectKey: `call:${STEP_CALL.key}`,
            effectId: "nivo.tool.customer.message.send",
            runId: RUN,
            stepKey: "answer",
            args: { conversationId: "c-1", text: "Da nhan" },
            subjectEntity: "message",
            subjectId: "m-1",
            facts: { conversationId: "c-1" },
        })
    })

    it("takes the place its caller names over the key's", async () => {
        const { service, store } = await build()

        await service.once(WS, "core.send", CALL, jest.fn().mockResolvedValue({ kind: "message", id: "m-1" }), {
            place: { runId: RUN, stepKey: "match" },
        })

        expect(store.insert).toHaveBeenCalledWith(WS, {
            effectKey: "call:run:0",
            effectId: "core.send",
            runId: RUN,
            stepKey: "match",
            args: null,
            subjectEntity: "message",
            subjectId: "m-1",
            facts: null,
        })
    })

    it("answers a replay with the facts the first call answered, not the subject alone", async () => {
        const { service, store } = await build()
        store.byKey.mockResolvedValue(recordedAs("order", "o-1", "nivo.tool.order.confirm", { facts: { totalVnd: 100_000 } }))

        await expect(service.once(WS, "nivo.tool.order.confirm", CALL, jest.fn())).resolves.toEqual({
            kind: "order",
            id: "o-1",
            facts: { totalVnd: 100_000 },
        })
    })
})

describe("GraphNodeEffectsService.once, an outcome nobody knows", () => {
    const unknown = (code: string): Error => Object.assign(new Error("sent, no answer"), { code })

    it.each([...OUTCOME_UNKNOWN_CODES])("keeps a call that ended with %s and rethrows it untouched", async (code: string) => {
        const { service, store } = await build()
        const thrown = unknown(code)

        await expect(service.once(WS, "nivo.tool.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(thrown))).rejects.toBe(thrown)

        expect(store.insert).toHaveBeenCalledWith(WS, {
            effectKey: `call:${STEP_CALL.key}`,
            effectId: "nivo.tool.agent.tag",
            runId: RUN,
            stepKey: "answer",
            args: null,
            subjectEntity: OUTCOME_UNKNOWN_KIND,
            subjectId: code,
            facts: { code },
        })
    })

    it("never makes such a call again: the key answers the same code, nothing acts", async () => {
        const { service, store } = await build()
        store.byKey.mockResolvedValue(recordedAs(OUTCOME_UNKNOWN_KIND, "tool_outcome_unknown", "nivo.tool.agent.tag"))
        const act = jest.fn()

        await expect(service.once(WS, "nivo.tool.agent.tag", STEP_CALL, act)).rejects.toMatchObject({ code: "tool_outcome_unknown" })

        expect(act).not.toHaveBeenCalled()
        expect(store.insert).not.toHaveBeenCalled()
    })

    it("keeps nothing for any other throw (the call may be made again, as before); a failed keep never hides the act's error", async () => {
        const { service, store } = await build()
        const other = Object.assign(new Error("refused"), { code: "provider_down" })

        await expect(service.once(WS, "nivo.tool.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(other))).rejects.toBe(other)
        expect(store.insert).not.toHaveBeenCalled()

        store.insert.mockRejectedValue(new Error("db down"))
        const thrown = unknown("tool_outcome_unknown")
        await expect(service.once(WS, "nivo.tool.agent.tag", STEP_CALL, jest.fn().mockRejectedValue(thrown))).rejects.toBe(thrown)
    })
})

describe("GraphNodeEffectsService.recordsOf", () => {
    it("reads a run step's records by run and step, oldest first, cut to the effects named, with their arguments and time", async () => {
        const { service, store } = await build()
        const args = { conversationId: "c-1", text: "Da nhan" }
        store.ofStep.mockResolvedValue([
            recordedAs("message", "m-1", "nivo.tool.customer.message.send", { args }),
            recordedAs("team-message", "t-1", "nivo.tool.team.message.post"),
        ])

        await expect(service.recordsOf(WS, { runId: RUN, stepKey: "match" }, ["nivo.tool.customer.message.send"])).resolves.toEqual([
            { effect: "nivo.tool.customer.message.send", args, subject: { kind: "message", id: "m-1" }, at: AT },
        ])
        expect(store.ofStep).toHaveBeenCalledWith(WS, RUN, "match", 100)
    })
})
