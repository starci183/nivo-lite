import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsError, BrainFactsErrorCode, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { GuardedBound } from "@modules/domain/brain-facts/in-force-bound.service"
import type { InForceBound } from "@modules/domain/brain-facts/in-force.policy"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CritiqueDecisionsService, DocumentCriticService } from "@modules/domain/dossier-review"
import type { OpenFinding } from "@modules/domain/dossier-review"
import { TRUTH_CRITIQUE_GATE } from "./direct-apply.policy"
import type { PassageCritique, TruthCritiqueGate } from "./direct-apply.policy"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService } from "./document-settle.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { BRAIN_ERROR_KINDS, BrainError, BrainErrorCode } from "./errors/brain.error"
import { TRUTH_CEILING } from "./truth-ceiling.policy"
import { TruthCeilingService } from "./truth-ceiling.service"
import { CHI_LAN_VI, TUY_LUC_VI, V_30_000_D_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"
import { SETTLE_HASH, SETTLE_STATE, objectLike, scriptSettleDoubles, settleFounderDoc, settleProposalOf, settleReviewed, stringLike } from "@tests/fixtures/builders/brain-document.builder"

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const HASH = SETTLE_HASH
const STATE = SETTLE_STATE
const proposalOf = settleProposalOf
const reviewed = settleReviewed
const founderDoc = settleFounderDoc

/** The bound of an automatic write: the ceiling, with its guard. */
const BOUND = objectLike({ truths: TRUTH_CEILING.truths, bytes: TRUTH_CEILING.bytes })

/** Whether the bound a write was given carries a guard. */
const guarded = (bound: InForceBound | undefined): bound is GuardedBound => bound !== undefined && "guard" in bound

const build = async (waiting: ReadonlyArray<FactRecord>, critique: PassageCritique = reviewed, bare = false) => {
    const logger = mock<Logger>()
    const facts = mock<BrainFactsService>()
    const reads = mock<BrainFactsReadService>()
    const extractions = mock<BrainExtractionsService>()
    const members = mock<WorkspaceMembersService>()
    const ceiling = mock<TruthCeilingService>()
    const critic = mock<TruthCritiqueGate>()
    const publicDocuments = mock<PublicDocumentsService>()
    const parts = mock<DocumentPartsService>()
    const vectors = mock<FactEmbeddingsService>()
    const decisions = mock<CritiqueDecisionsService>()
    scriptSettleDoubles({ facts, reads, extractions, members, ceiling, critic, publicDocuments, parts, vectors }, { waiting, critique, bare })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentSettleService,
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: TruthCeilingService, useValue: ceiling },
            { provide: DocumentPartsService, useValue: parts },
            { provide: PublicDocumentsService, useValue: publicDocuments },
            { provide: FactEmbeddingsService, useValue: vectors },
            { provide: CritiqueDecisionsService, useValue: decisions },
            // A critic that has no such read yet (bare): no point holds anything.
            { provide: TRUTH_CRITIQUE_GATE, useValue: bare ? {} : critic },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentSettleService), facts, reads, extractions, ceiling, critic, parts, publicDocuments, logger, vectors, decisions }
}

describe("DocumentSettleService: a member's document goes in force as soon as it is read (owner 2026-11-12)", () => {
    it("puts the truths of a founder's document in force and announces them once", async () => {
        const t = await build([proposalOf(), proposalOf({ id: "f2", subjectKey: "gio-mo-cua" })])

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(2)
        expect(t.facts.announceChanged).toHaveBeenCalledTimes(1)
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, ["f1", "f2"])
        expect(t.reads.ofSources).toHaveBeenCalledWith(WS, [SOURCE], ["proposed"], 2000)
        expect(t.extractions.save).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({ status: "running", stage: "settle", counts: objectLike({ factsApplied: 2, factsAsked: 0, factsWaiting: 0 }) }),
        )
    })

    it.each([
        ["manager", "Minh Manager"],
        ["staff", "Sau Staff"],
        ["founder", "Founder"],
    ])("D3: the upload of a %s (any active member) applies directly, decided by that member, the note naming role and name", async (userId, name) => {
        const t = await build([proposalOf()])
        const role = userId === "founder" ? "owner" : userId

        await expect(t.service.settle(docSourceOf({ createdBy: userId, status: "ready" }), [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", name, stringLike(`direct:${SOURCE} - In force from the document "Hours" put in by ${role} ${name}`), BOUND)
    })

    it("a document no active member stands behind (a person who left, a sync, an API key) keeps its truths waiting, with no read of the critic or the ceiling", async () => {
        for (const createdBy of ["left-the-team", null]) {
            const t = await build([proposalOf()])

            await expect(t.service.settle(docSourceOf({ createdBy }), [], STATE)).resolves.toBeNull()

            expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
            expect(t.critic.truthGateOf).not.toHaveBeenCalled()
            expect(t.ceiling.room).not.toHaveBeenCalled()
            expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsWaiting: 1 }) }))
        }
    })

    it.each([
        ["waiting", { ...reviewed, state: "waiting" as const, reviewed: new Set<string>() }],
        ["running", { ...reviewed, state: "running" as const, reviewed: new Set<string>() }],
        ["not_done", { ...reviewed, state: "not_done" as const, reason: "credits", reviewed: new Set<string>(), waitingPassages: 1 }],
        ["none", { ...reviewed, state: "none" as const, reviewed: new Set<string>() }],
    ])("a critique %s never holds the settle: the truth applies and the reading ends", async (_state, critique) => {
        const t = await build([proposalOf()], critique)

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike(`direct:${SOURCE}`), BOUND)
    })

    it("with no critic that can be asked, nothing holds: the truth applies", async () => {
        const t = await build([proposalOf()], reviewed, true)

        await expect(t.service.critiqueOf(WS, SOURCE)).resolves.toMatchObject({ state: "none" })
        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
    })

    it("a truth flagged stale or period_unclear, or with no passage hash, applies like any other", async () => {
        const t = await build([
            proposalOf({ id: "stale", subjectKey: "a", flags: ["stale"] }),
            proposalOf({ id: "unclear", subjectKey: "b", flags: ["period_unclear"] }),
            proposalOf({ id: "bare", subjectKey: "c", evidence: [{ kind: "document", ref: SOURCE, label: "Doc", sourceId: SOURCE }] }),
        ])

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced.mock.calls.map(([, id]) => id)).toEqual(["stale", "unclear", "bare"])
    })

    it("a window already over is handed to the store like any truth (the store files it as history, never as the value in force): no question", async () => {
        const over = proposalOf({ validFrom: "2025-01-01T00:00:00.000Z", validTo: "2025-02-01T00:00:00.000Z" })
        const t = await build([over])

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike("direct:"), BOUND)
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 0 }) }))
    })
})

describe("DocumentSettleService: the room at the ceiling and the listeners", () => {
    it("parks at the ceiling when the room read says full", async () => {
        const full = await build([proposalOf()])
        full.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })
        await expect(full.service.settle(founderDoc, [], STATE)).resolves.toEqual({ status: "at_ceiling", note: "BRAIN_NOTE_TRUTH_CEILING" })
        expect(full.facts.applyUnannounced).not.toHaveBeenCalled()
    })

    it("lets the STORE decide the room: settles of other documents took the last places since this one read the room (D-U-1)", async () => {
        const t = await build([
            proposalOf({ id: "a", subjectKey: "ca-sang" }),
            proposalOf({ id: "b", subjectKey: "ca-chieu" }),
            proposalOf({ id: "c", subjectKey: "ca-toi" }),
        ])
        t.facts.applyUnannounced
            .mockResolvedValueOnce(proposalOf({ id: "a", status: "active" }))
            .mockRejectedValueOnce(new BrainFactsError({ code: BrainFactsErrorCode.InForceFull }))
        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toEqual({ status: "at_ceiling", note: "BRAIN_NOTE_TRUTH_CEILING" })
        expect(t.facts.applyUnannounced.mock.calls.map(([, id, , , bound]) => [id, bound])).toEqual([
            ["a", BOUND],
            ["b", BOUND],
        ])
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, ["a"])
        expect(t.extractions.save).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({ status: "at_ceiling", counts: objectLike({ factsApplied: 1, factsAsked: 0, factsWaiting: 2 }) }),
        )
        expect(t.logger.error).not.toHaveBeenCalled()
    })

    it("the listeners are told AFTER the write, also when a later truth fails the settle (VERIFY-6)", async () => {
        const t = await build([proposalOf({ id: "a", subjectKey: "ca-sang" }), proposalOf({ id: "b", subjectKey: "ca-chieu" })])
        t.facts.applyUnannounced.mockResolvedValue(proposalOf({ id: "a", status: "active" }))
        t.vectors.recheckBeforeForce.mockResolvedValueOnce("clear").mockRejectedValueOnce(new Error("judge down"))

        await expect(t.service.settle(founderDoc, [], STATE)).rejects.toThrow("judge down")

        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, ["a"])
        const [wrote = 0] = t.facts.applyUnannounced.mock.invocationCallOrder
        const [told = 0] = t.facts.announceChanged.mock.invocationCallOrder
        expect(wrote).toBeGreaterThan(0)
        expect(told).toBeGreaterThan(wrote)
    })
})

describe("DocumentSettleService: the race of two documents settled at once, checked under the in-force lock", () => {
    const rivalOf = (value: string) =>
        proposalOf({ id: "a1", status: "active", value, decisionNote: "direct:doc-b - In force from the document \"Price list\"", evidence: [{ kind: "document", ref: "doc-b", label: "B", sourceId: "doc-b" }] })

    /** Scripts a write whose guard runs (as the store does under the lock) after another document put `appeared` in force. */
    const raceWith = (t: Awaited<ReturnType<typeof build>>, appeared: FactRecord) => {
        const inForce: Array<FactRecord> = []
        t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "active" ? [...inForce] : []))
        t.facts.mergeDuplicate.mockResolvedValue(appeared)
        t.facts.applyUnannounced.mockImplementation(async (_ws, id, _by, _note, bound) => {
            inForce.push(appeared)
            if (guarded(bound)) await bound.guard()
            return proposalOf({ id, status: "active" })
        })
    }

    it("the second writer is asked: a rival value from another source came in force since its verdict; nothing is written over the first", async () => {
        const t = await build([proposalOf()])
        raceWith(t, rivalOf("25.000"))

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike("direct:"), BOUND)
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, [])
        expect(t.facts.mergeDuplicate).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsApplied: 0, factsAsked: 1 }) }))
        expect(t.logger.error).not.toHaveBeenCalled()
    })

    it("the same value came in force meanwhile: the truth joins it (its source added), nothing is asked or written over it", async () => {
        const t = await build([proposalOf()])
        raceWith(t, rivalOf("30.000"))

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.mergeDuplicate).toHaveBeenCalledWith(WS, "f1", "a1")
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, [])
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsApplied: 0, factsAsked: 0 }) }))
    })

    it.each([
        ["raced", "25.000"],
        ["joined", "30.000"],
    ] as const)("the guard refuses the write with the brain error SettleLostRace carrying the outcome %s, kind conflict", async (outcome, value) => {
        const t = await build([proposalOf()])
        const seen: Array<unknown> = []
        raceWith(t, rivalOf(value))
        const write = t.facts.applyUnannounced.getMockImplementation()
        t.facts.applyUnannounced.mockImplementation(async (...args) => {
            try {
                return await (write as NonNullable<typeof write>)(...args)
            } catch (cause) {
                seen.push(cause)
                throw cause
            }
        })

        await t.service.settle(founderDoc, [], STATE)

        expect(seen).toHaveLength(1)
        expect(seen[0]).toBeInstanceOf(BrainError)
        expect(seen[0]).toMatchObject({ code: BrainErrorCode.SettleLostRace, params: { outcome } })
        expect(BRAIN_ERROR_KINDS[BrainErrorCode.SettleLostRace]).toBe("conflict")
    })

    it("nothing appeared: the guard lets the write through", async () => {
        const t = await build([proposalOf()])
        t.facts.applyUnannounced.mockImplementation(async (_ws, id, _by, _note, bound) => {
            if (guarded(bound)) await bound.guard()
            return proposalOf({ id, status: "active" })
        })

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, ["f1"])
    })
})

describe("DocumentSettleService: what the founder's answer decides", () => {
    it("a truth the founder KEPT that is already in force is told to the critic again at every settle (VERIFY-6)", async () => {
        const decided = new Map([["kept", { kind: "confirmed" as const, by: "Founder (answer)" }]])
        const t = await build([proposalOf({ id: "f2", subjectKey: "gio-mo-cua" })], { ...reviewed, decided })

        await t.service.settle(founderDoc, [], STATE)

        expect(t.decisions.factsChanged.mock.calls).toEqual([[WS, ["kept"]]])
        const [told = 0] = t.decisions.factsChanged.mock.invocationCallOrder
        const [wrote = 0] = t.facts.applyUnannounced.mock.invocationCallOrder
        expect(told).toBeLessThan(wrote)
    })

    it("tells the critic nothing when no answer decided a truth, or when the decided truth still waits", async () => {
        const plain = await build([proposalOf()])
        await plain.service.settle(founderDoc, [], STATE)
        expect(plain.decisions.factsChanged).not.toHaveBeenCalled()

        const decided = new Map([["f1", { kind: "confirmed" as const, by: "Founder (answer)" }]])
        const waits = await build([proposalOf()], { ...reviewed, decided })
        await waits.service.settle(founderDoc, [], STATE)
        expect(waits.decisions.factsChanged).not.toHaveBeenCalled()
        expect(waits.facts.announceChanged).toHaveBeenCalledWith(WS, ["f1"])
    })

    it("never bounds the founder's own answer: a confirmed truth is written with no bound, whatever the room", async () => {
        const decided = new Map([["f1", { kind: "confirmed" as const, by: "Founder (answer)" }]])
        const t = await build([proposalOf()], { ...reviewed, decided })
        t.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })
        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()
        expect(t.facts.applyUnannounced.mock.calls).toEqual([[WS, "f1", "Founder (answer)", stringLike(`confirmed:${SOURCE}`)]])
    })

    it("an answered truth whose passage the critic never read goes in force as decided (no truth waits for the critic)", async () => {
        const decided = new Map([["f1", { kind: "confirmed" as const, by: CHI_LAN_VI }]])
        const t = await build([proposalOf()], { ...reviewed, state: "not_done", reason: "credits", reviewed: new Set(), decided })

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", CHI_LAN_VI, stringLike(`confirmed:${SOURCE}`))
    })

    it("the value the founder typed on a point goes in force as HIS correction (never refused for room)", async () => {
        const typed = proposalOf({ id: "own", sourceKind: "owner", value: "35.000", evidence: [{ kind: "manual", ref: "critic:p1", label: "answer" }] })
        const critique: PassageCritique = { ...reviewed, decided: new Map([["own", { kind: "corrected", by: "" }]]) }
        const t = await build([], critique)
        t.reads.byIds.mockResolvedValue([typed, proposalOf({ id: "gone", status: "rejected" })])
        t.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.reads.byIds).toHaveBeenCalledWith(WS, ["own"])
        // No name was kept with the answer: the member behind the document decides.
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "own", "Founder", stringLike(`corrected:${SOURCE}`))
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, ["own"])
    })

    it("an answered value that is not of the type of the truth in force stays a question", async () => {
        const inForce = proposalOf({ id: "now", status: "active", value: V_30_000_D_VI })
        const typed = proposalOf({ value: TUY_LUC_VI, valueNumber: null })
        const t = await build([typed], { ...reviewed, decided: new Map([["f1", { kind: "confirmed", by: CHI_LAN_VI }]]) })
        t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "active" ? [inForce] : []))

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })
})

/** The critic's dossier-review service satisfies the gate the settle reads (the module binds it with `useExisting`). */
export const GATE_OF_THE_CRITIC: (critic: DocumentCriticService) => TruthCritiqueGate = (critic) => critic

const OTHER = "hash-b"
const finding = (kind: string, more: Partial<OpenFinding> = {}): OpenFinding => ({
    id: `point-${kind}`,
    group: kind,
    kind,
    severity: "high",
    holds: true,
    hashes: [HASH],
    factIds: ["f1"],
    namesAll: false,
    ...more,
})
const clean = proposalOf({ id: "f2", subjectKey: "gio-mo-cua", evidence: [{ kind: "document", ref: SOURCE, label: "Doc", sourceId: SOURCE, chunkHash: OTHER }] })

describe("DocumentSettleService: only a holding point asks", () => {
    it.each([["shop_contradiction"], ["other_document"], ["inside_contradiction"], ["addressed_to_ai"]])(
        "an open holding point of kind %s: its truth is asked, the other passage's truth goes in force",
        async (kind) => {
            const critique: PassageCritique = { ...reviewed, held: new Set([HASH]), findings: [finding(kind)] }
            const t = await build([proposalOf(), clean], critique)

            await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

            expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
            expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f2", "Founder", stringLike(`direct:${SOURCE}`), BOUND)
            expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsApplied: 1, factsAsked: 1, factsWaiting: 0 }) }))
        },
    )

    it.each([["typo"], ["unclear"], ["stale"], ["hearsay"]])(
        "an old open point of kind %s holds nothing (holds false): the truth it names goes in force",
        async (kind) => {
            const t = await build([proposalOf()], { ...reviewed, findings: [finding(kind, { holds: false })] })

            await t.service.settle(founderDoc, [], STATE)

            expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike("direct:"), BOUND)
        },
    )

    it("the founder's answer applies ONLY the truth it names; another truth a holding point still names is asked", async () => {
        const second = proposalOf({ id: "f3", subjectKey: "phi-goi-qua" })
        const critique: PassageCritique = {
            ...reviewed,
            findings: [finding("other_document", { factIds: ["f3"], namesAll: true })],
            decided: new Map([["f1", { kind: "confirmed", by: CHI_LAN_VI }]]),
        }
        const t = await build([proposalOf(), second], critique)

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", CHI_LAN_VI, stringLike(`confirmed:${SOURCE}`))
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsApplied: 1, factsAsked: 1 }) }))
    })
})
