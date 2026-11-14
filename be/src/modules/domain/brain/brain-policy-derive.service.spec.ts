import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAttempt, AiCutSpend, AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, workInScope } from "@modules/platform/logging"
import type { Logger, WorkScope } from "@modules/platform/logging"
import { ADDRESS, DERIVE_NOW, FEE, HOURS, deriveFactOf, derivedOf } from "@tests/fixtures/builders/policy-derive.builder"
import { DIA_CHI_VI, GIAO_HANG_VI, GIO_LAM_VIEC_VI, GIO_MO_CUA_VI, GROUPS_IN_USE_GIAO_HANG_GIO_LAM_VIEC_VI, MUC_PHI_CHU_TIEM_CHINH_DUOC_VI, PHI_GIAO_HANG_NOI_THANH_VI, PHI_GIAO_HANG_VI, PHI_SHIP_NOI_THANH_VI, PHI_SHIP_VI, SO_THICH_VI, V_35_000_D_MOT_DON_VI, V_45_000_D_VI, WAS_POLICY_PHI_GIAO_HANG_IN_GROUP_GIAO_HANG_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"
import { MemoryCandidates, MemoryStore, SCRIPT, answer, answerOf } from "@tests/fixtures/builders/brain-b.builder"
import type { ScriptOf } from "@tests/fixtures/builders/brain-b.builder"
import { BrainPolicyCandidatesService } from "./brain-policy-candidates.service"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainPolicyDeriveService } from "./brain-policy-derive.service"
import { BrainPolicyStoreService } from "./brain-policy-store.service"
import { BrainErrorCode } from "./errors/brain.error"
import { ModelJsonService } from "./model-json.service"
import type { DerivedPolicy } from "./policy-derive.policy"


const WS = "11111111-1111-4111-8111-111111111111"
const STARTED = new Date(DERIVE_NOW)

/** What one case sets up: the facts in force and, when it needs them, the judgements kept, the failed tries and the scripted model. */
interface DeriveOptions {
    readonly facts: ReadonlyArray<FactRecord>
    readonly stored?: ReadonlyArray<DerivedPolicy>
    readonly attempts?: number
    readonly script?: ScriptOf
}

const build = async (options: DeriveOptions) => {
    const ai = mock<AiService>()
    ai.available.mockReturnValue(true)
    ai.chat.mockImplementation((request) => Promise.resolve(answer(answerOf(request, options.script ?? SCRIPT))))
    // The pass calls `attempt` (a cut answer is a failure of its own); these cases script `chat`, which `attempt` wraps.
    ai.attempt.mockImplementation(async (request) => {
        const said = await ai.chat(request)
        return said === null ? { ok: false, failure: "provider" } : { ok: true, answer: said }
    })
    const logger = mock<Logger>()
    const reads = mock<BrainFactsReadService>()
    const facts = [...options.facts]
    reads.byIds.mockImplementation((_ws, ids) => Promise.resolve(facts.filter((fact) => ids.includes(fact.id))))
    const memory = new MemoryStore(options.stored)
    memory.facts = () => facts
    const store = mock<BrainPolicyStoreService>()
    store.groupsInUse.mockImplementation((ws, limit) => memory.groupsInUse(ws, limit))
    store.hasAny.mockImplementation(() => memory.hasAny())
    store.ofTruths.mockImplementation((ws, keys) => memory.ofTruths(ws, keys))
    store.orphaned.mockImplementation((ws, limit) => memory.orphaned(ws, limit))
    store.rebind.mockImplementation((ws, moves) => memory.rebind(ws, moves))
    store.retire.mockImplementation((ws, ids) => memory.retire(ws, ids))
    store.save.mockImplementation((ws, judged) => memory.save(ws, judged))
    const candidates = new MemoryCandidates(() => facts, memory)
    const candidatesDouble = mock<BrainPolicyCandidatesService>()
    candidatesDouble.page.mockImplementation((ws, after, limit) => candidates.page(ws, after, limit))
    const derivations = mock<BrainPolicyDerivationsService>()
    derivations.started.mockResolvedValue({ startedAt: STARTED, attempts: options.attempts ?? 0 })
    derivations.finished.mockResolvedValue("idle")
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const booked: Array<WorkScope | null> = []
    usage.record.mockImplementation(() => {
        booked.push(workInScope())
        return Promise.resolve()
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPolicyDeriveService,
            ModelJsonService,
            { provide: AI, useValue: ai },
            { provide: CLOCK, useValue: new FakeClock(DERIVE_NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainPolicyStoreService, useValue: store },
            { provide: BrainPolicyCandidatesService, useValue: candidatesDouble },
            { provide: BrainPolicyDerivationsService, useValue: derivations },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(BrainPolicyDeriveService), ai, reads, store: memory, derivations, usage, booked, logger, candidates, facts }
}

/** Two hundred facts: more than one pass judges, so a pass says "more". */
const many = Array.from({ length: 200 }, (_, index) =>
    deriveFactOf({ id: `f${String(index)}`, attribute: `a-${String(index)}`, attributeLabel: DIA_CHI_VI }),
)

describe("BrainPolicyDeriveService: first derive", () => {
    it("judges every truth in force in one call: rules become policies with a title and a group, identity data does not", async () => {
        const { service, ai, store, derivations, reads } = await build({ facts: [FEE, HOURS, ADDRESS] })

        const pass = await service.pass(WS)

        expect(pass).toEqual({ outcome: "done", judged: 3, rebound: 0, retired: 0, calls: 1 })
        expect(ai.chat).toHaveBeenCalledTimes(1)
        // ONE candidate page (three statements: the page, the facts by id, the judgements of its keys); never a window of facts.
        expect(reads.list).not.toHaveBeenCalled()
        expect(reads.byIds).toHaveBeenCalledTimes(1)
        expect(store.of("fee")).toMatchObject({
            kind: "policy",
            title: PHI_GIAO_HANG_NOI_THANH_VI,
            groupLabel: GIAO_HANG_VI,
            groupKey: "giao-hang",
            valueType: "money",
            factId: "fee",
            factVersion: 1,
            reason: MUC_PHI_CHU_TIEM_CHINH_DUOC_VI,
        })
        expect(store.of("hours")).toMatchObject({ kind: "policy", groupLabel: GIO_LAM_VIEC_VI, valueType: "time_range" })
        expect(store.of("address")).toMatchObject({ kind: "not_policy", title: "", groupLabel: "" })
        expect(derivations.finished).toHaveBeenCalledWith(WS, STARTED)
    })

    it("caps the answer, turns reasoning off and books the call as brain under the work kind policy_derive, step derive", async () => {
        const { service, ai, usage, booked } = await build({ facts: [FEE] })

        await service.pass(WS)

        const [request] = ai.chat.mock.calls[0] ?? []
        expect(request?.budget).toEqual({ effort: "off", maxTokens: 4000 })
        expect(request?.timeoutMs).toBe(45_000)
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, kind: "brain", module: "knowledge", model: "claude-haiku-5-5" }),
        )
        expect(booked).toEqual([expect.objectContaining({ kind: "policy_derive", ref: `workspace:${WS}`, stepKey: "derive" })])
    })

    it("never sends a customer's or a person's facts to the model", async () => {
        const customer = deriveFactOf({ id: "c", subjectType: "customer", subjectKey: "chi-lan", attributeLabel: SO_THICH_VI, attribute: "so-thich" })
        const { service, ai } = await build({ facts: [customer] })

        const pass = await service.pass(WS)

        expect(pass.outcome).toBe("done")
        expect(ai.chat).not.toHaveBeenCalled()
    })
})

describe("BrainPolicyDeriveService: re-derive", () => {
    const stored = [derivedOf(FEE), derivedOf(HOURS, { group: GIO_LAM_VIEC_VI }), derivedOf(ADDRESS, { kind: "not_policy" })]

    it("add: only the new truth goes to the model, with the groups in use", async () => {
        const express = deriveFactOf({ id: "express", attribute: "phi-ship", attributeLabel: PHI_SHIP_VI, value: V_45_000_D_VI })
        const { service, ai, store, booked } = await build({ facts: [FEE, HOURS, ADDRESS, express], stored })

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "done", judged: 1, calls: 1 })
        const prompt = ai.chat.mock.calls[0]?.[0].messages[1]?.content ?? ""
        expect(prompt).toContain(PHI_SHIP_VI)
        expect(prompt).not.toContain(GIO_MO_CUA_VI)
        expect(prompt).not.toContain(DIA_CHI_VI)
        expect(prompt).toContain(GROUPS_IN_USE_GIAO_HANG_GIO_LAM_VIEC_VI)
        expect(store.of("express")).toMatchObject({ kind: "policy", groupLabel: GIAO_HANG_VI })
        expect(booked[0]).toMatchObject({ stepKey: "rederive" })
    })

    it("an edited value re-binds the policy to the new version with no model call", async () => {
        const next = deriveFactOf({ id: "fee-v2", value: V_35_000_D_MOT_DON_VI, version: 2, supersedesId: "fee" })
        const { service, ai, store } = await build({ facts: [next, HOURS, ADDRESS], stored })

        const pass = await service.pass(WS)

        expect(pass).toEqual({ outcome: "done", judged: 0, rebound: 1, retired: 0, calls: 0 })
        expect(ai.chat).not.toHaveBeenCalled()
        expect(store.rows.find((row) => row.id === "p-fee")).toMatchObject({
            factId: "fee-v2",
            factVersion: 2,
            title: PHI_GIAO_HANG_VI,
            status: "open",
        })
    })

    it("amend: a relabelled truth is compared by the model and its judgement rewritten in place", async () => {
        const relabelled = deriveFactOf({ id: "fee-v2", attributeLabel: PHI_SHIP_VI, version: 2 })
        const { service, ai, store } = await build({ facts: [relabelled, HOURS, ADDRESS], stored })

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "done", judged: 1, calls: 1 })
        expect(ai.chat.mock.calls[0]?.[0].messages[1]?.content).toContain(WAS_POLICY_PHI_GIAO_HANG_IN_GROUP_GIAO_HANG_VI)
        expect(store.rows.filter((row) => row.subjectKey === FEE.subjectKey)).toHaveLength(1)
        expect(store.rows.find((row) => row.id === "p-fee")).toMatchObject({ factId: "fee-v2", title: PHI_SHIP_NOI_THANH_VI })
    })

    it("retire: the policy of a truth nothing holds any more is retired with no model call", async () => {
        const { service, ai, store } = await build({ facts: [HOURS, ADDRESS], stored })

        const pass = await service.pass(WS)

        expect(pass).toEqual({ outcome: "done", judged: 0, rebound: 0, retired: 1, calls: 0 })
        expect(ai.chat).not.toHaveBeenCalled()
        expect(store.rows.find((row) => row.id === "p-fee")?.status).toBe("retired")
    })

    it("idempotent: a second pass over the result of the first calls no model and writes nothing", async () => {
        const { service, ai, store } = await build({ facts: [FEE, HOURS, ADDRESS] })
        await service.pass(WS)
        const writes = store.writes
        const rows = [...store.rows]

        const again = await service.pass(WS)

        expect(again).toEqual({ outcome: "done", judged: 0, rebound: 0, retired: 0, calls: 0 })
        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(store.writes).toBe(writes)
        expect(store.rows).toEqual(rows)
    })
})

describe("BrainPolicyDeriveService: bounds and failures, a large workspace and a silent model", () => {
    it("a large workspace is judged ten calls of twelve a pass; the rest continues in a follow-up job", async () => {
        const { service, ai, derivations } = await build({ facts: many })

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "more", judged: 120, calls: 10 })
        expect(ai.chat).toHaveBeenCalledTimes(10)
        expect(derivations.more).toHaveBeenCalledWith(WS)
        expect(derivations.finished).not.toHaveBeenCalled()
    })

    it("a truth the model skipped stays to be judged: the pass says more, never done", async () => {
        const { service, store, derivations } = await build({ facts: [FEE, HOURS], script: { [PHI_GIAO_HANG_VI]: SCRIPT[PHI_GIAO_HANG_VI] ?? { policy: true }, [GIO_MO_CUA_VI]: undefined } })

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "more", judged: 1 })
        expect(store.of("hours")).toBeUndefined()
        expect(derivations.more).toHaveBeenCalledWith(WS)
    })

    it("no answer from the model: the try is counted and the job throws for the queue to retry; nothing is stored", async () => {
        const { service, ai, store, derivations } = await build({ facts: [FEE] })
        ai.chat.mockResolvedValue(null)

        await expect(service.pass(WS)).rejects.toMatchObject({ code: BrainErrorCode.ModelUnavailable })

        expect(derivations.retrying).toHaveBeenCalledWith(WS, 1)
        expect(derivations.failed).not.toHaveBeenCalled()
        expect(store.rows).toEqual([])
    })

    it("an unreadable answer on the third try gives the pass up: recorded as failed and logged, not thrown", async () => {
        const { service, ai, derivations, logger } = await build({ facts: [FEE], attempts: 2 })
        ai.chat.mockResolvedValue(answer("I cannot help with that."))

        const pass = await service.pass(WS)

        expect(pass.outcome).toBe("failed")
        expect(derivations.failed).toHaveBeenCalledWith(WS, "model", 3)
        expect(logger.error).toHaveBeenCalledWith("brain.policies.gave_up", expect.any(Error), { workspaceId: WS })
    })

    it("stops calling the model after a batch that got no answer, keeping what the earlier batches stored", async () => {
        const { service, ai, store, derivations } = await build({ facts: many })
        ai.chat.mockImplementationOnce((request) => Promise.resolve(answer(answerOf(request, SCRIPT)))).mockResolvedValue(null)

        const pass = await service.pass(WS)

        expect(ai.chat).toHaveBeenCalledTimes(2)
        expect(pass).toMatchObject({ outcome: "more", judged: 12 })
        expect(store.rows).toHaveLength(12)
        expect(derivations.more).toHaveBeenCalledWith(WS)
    })
})

describe("BrainPolicyDeriveService: bounds and failures, a cut batch and a missing service", () => {
    it("D-BR-2: a batch cut at the token cap is booked, halved and judged again; the pass converges and nothing judged is lost", async () => {
        const twelve = many.slice(0, 12)
        const { service, ai, store, usage, logger } = await build({ facts: twelve })
        const spent: AiCutSpend = {
            model: "claude-haiku-5-5",
            usage: { promptTokens: 900, completionTokens: 4000, totalTokens: 4900, costUsd: 0.004 },
            served: { upstream: null, finishReason: "length", durationMs: 10 },
            cap: 4000,
        }
        const cut: AiChatAttempt = { ok: false, failure: "length", spent }
        // The whole batch of 12 is cut; its halves of 6 answer.
        ai.attempt.mockResolvedValueOnce(cut)

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "done", judged: 12, calls: 3 })
        expect(store.rows).toHaveLength(12)
        // The cut call is booked with what it spent (D-BR-15), the two halves with their answers.
        expect(usage.record).toHaveBeenCalledTimes(3)
        expect(usage.record).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ kind: "brain", usage: spent.usage, completionChars: 0, failure: "length" }),
        )
        // The batches that answered are billed: no failure on them.
        expect(usage.record.mock.calls[1]?.[0]).not.toHaveProperty("failure")
        expect(logger.warn).toHaveBeenCalledWith("brain.policies.batch_cut", { workspaceId: WS, facts: 12 })
        const sizes = ai.attempt.mock.calls.map(
            ([request]) => (request.messages[1]?.content ?? "").split("\n").filter((line) => /^\d+\. /.test(line)).length,
        )
        expect(sizes).toEqual([12, 6, 6])
    })

    it("D-BR-2: a later batch that fails keeps what the earlier batches of the pass judged", async () => {
        const { service, ai, store } = await build({ facts: many.slice(0, 24) })
        ai.chat.mockImplementationOnce((request) => Promise.resolve(answer(answerOf(request, SCRIPT)))).mockResolvedValue(null)

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "more", judged: 12 })
        expect(store.rows).toHaveLength(12)
    })

    it("no credits: no model call, the state says credits", async () => {
        const { service, ai, usage, derivations } = await build({ facts: [FEE] })
        usage.blockedBy.mockResolvedValue(true)

        const pass = await service.pass(WS)

        expect(pass.outcome).toBe("blocked")
        expect(ai.chat).not.toHaveBeenCalled()
        expect(derivations.failed).toHaveBeenCalledWith(WS, "credits")
    })

    it("no AI endpoint: the state says failed, and the re-binds were still done", async () => {
        const next = deriveFactOf({ id: "fee-v2", value: V_35_000_D_MOT_DON_VI, version: 2 })
        const { service, ai, store, derivations } = await build({ facts: [next, HOURS], stored: [derivedOf(FEE)] })
        ai.available.mockReturnValue(false)

        const pass = await service.pass(WS)

        expect(pass).toMatchObject({ outcome: "failed", rebound: 1 })
        expect(store.rows.find((row) => row.id === "p-fee")?.factId).toBe("fee-v2")
        expect(derivations.failed).toHaveBeenCalledWith(WS, "model")
    })
})

describe("BrainPolicyDeriveService: the job", () => {
    it("runs the pass of the workspace the payload names", async () => {
        const { service, derivations } = await build({ facts: [] })

        await expect(service.run({ workspaceId: WS })).resolves.toBe("done")
        expect(derivations.started).toHaveBeenCalledWith(WS)
    })

    it("drops a payload of another shape", async () => {
        const { service, derivations, logger } = await build({ facts: [] })

        await expect(service.run({ sourceId: "x" })).resolves.toBe("skipped")
        expect(derivations.started).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith("brain.policies.payload_refused", { job: "policies" })
    })

    it("a dead-lettered job is recorded on the state and logged", async () => {
        const { service, derivations, logger } = await build({ facts: [] })

        await service.giveUp({ workspaceId: WS })

        expect(derivations.failed).toHaveBeenCalledWith(WS, "gave_up")
        expect(logger.error).toHaveBeenCalledWith("brain.policies.gave_up", expect.any(Error), { workspaceId: WS })
    })
})

describe("BrainPolicyDeriveService at 5,000 truths in force (BRAIN-LIMITS item 3)", () => {
    const N = 5000
    const truths = Array.from({ length: N }, (_, index) =>
        deriveFactOf({ id: `t${String(index).padStart(5, "0")}`, attribute: `a-${String(index).padStart(5, "0")}`, attributeLabel: DIA_CHI_VI }),
    )

    /** Runs passes the way the queue does (a `more` queues the next) until one is done; answers what they did. */
    const untilDone = async (
        service: BrainPolicyDeriveService,
        passes: Array<Awaited<ReturnType<BrainPolicyDeriveService["pass"]>>> = [],
    ): Promise<ReadonlyArray<Awaited<ReturnType<BrainPolicyDeriveService["pass"]>>>> => {
        const pass = await service.pass(WS)
        const all = [...passes, pass]
        return pass.outcome !== "more" || all.length >= 200 ? all : untilDone(service, all)
    }

    it("judges every truth exactly once, a constant number of statements per page, and never re-reads a settled truth", async () => {
        const { service, ai, store, reads, candidates } = await build({ facts: truths })

        const passes = await untilDone(service)

        expect(passes.at(-1)?.outcome).toBe("done")
        // No truth skipped and none judged twice: one judgement per truth, each written once.
        expect(store.rows).toHaveLength(N)
        expect(new Set(store.rows.map((row) => row.factId)).size).toBe(N)
        expect(store.writes).toBe(N)
        expect(passes.reduce((sum, pass) => sum + pass.judged, 0)).toBe(N)
        expect(ai.chat).toHaveBeenCalledTimes(Math.ceil(N / 12))
        // Each page is three statements (the page, the facts by id, the judgements of its keys): pages = byIds calls, never a full read.
        expect(reads.list).not.toHaveBeenCalled()
        expect(reads.byIds).toHaveBeenCalledTimes(candidates.pages)
        expect(candidates.pages).toBe(Math.ceil(N / 120))
        // A page reads at most 200 truths: no statement ever reads the workspace whole.
        for (const call of reads.byIds.mock.calls) expect(call[1].length).toBeLessThanOrEqual(200)
    })

    it("5,000 value-only edits re-bind every judgement with NO model call, in pages; a pass over the result reads one empty page", async () => {
        const { service, ai, store, facts, candidates } = await build({ facts: truths })
        await untilDone(service)
        const calls = ai.chat.mock.calls.length
        // Every value changes, the same kind of value (30,000 dong -> 35,000 dong): the next version of each fact.
        facts.splice(
            0,
            facts.length,
            ...truths.map((fact) => ({ ...fact, id: `${fact.id}-v2`, value: V_35_000_D_MOT_DON_VI, valueNumber: 35000, version: 2, supersedesId: fact.id })),
        )
        const pagesBefore = candidates.pages

        const passes = await untilDone(service)

        expect(ai.chat).toHaveBeenCalledTimes(calls)
        expect(passes.reduce((sum, pass) => sum + pass.rebound, 0)).toBe(N)
        expect(store.rows.every((row) => row.factId.endsWith("-v2") && row.factVersion === 2 && row.status === "open")).toBe(true)
        // 25 full pages of 200, then one empty page that ends the work.
        expect(candidates.pages - pagesBefore).toBe(N / 200 + 1)

        const writes = store.writes
        const pagesAtRest = candidates.pages
        await expect(service.pass(WS)).resolves.toEqual({ outcome: "done", judged: 0, rebound: 0, retired: 0, calls: 0 })
        expect(candidates.pages - pagesAtRest).toBe(1)
        expect(store.writes).toBe(writes)
    })
})
