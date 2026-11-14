import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CritiqueDecisionsService } from "@modules/domain/dossier-review"
import type { OpenFinding } from "@modules/domain/dossier-review"
import { TRUTH_CRITIQUE_GATE } from "./direct-apply.policy"
import type { PassageCritique, TruthCritiqueGate } from "./direct-apply.policy"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService, contestedOf } from "./document-settle.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { TRUTH_CEILING } from "./truth-ceiling.policy"
import { TruthCeilingService } from "./truth-ceiling.service"
import { CHI_LAN_SUA_TREN_TRANG_VI, CHI_LAN_SUA_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"
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

describe("DocumentSettleService: the parts of a file settle independently; a contradiction across them still asks", () => {
    const PART_TWO = "33333333-3333-4333-8333-333333333333"

    it("a part settles as soon as its own reading ends, whatever the other parts: its truths go in force, the others are never waited for", async () => {
        const t = await build([proposalOf()])
        t.parts.wholeOf.mockResolvedValue([SOURCE, PART_TWO])
        // Part two is still being read: it has no waiting truth yet.
        t.reads.ofSources.mockImplementation((_ws, ids) => Promise.resolve(ids.includes(PART_TWO) ? [] : [proposalOf()]))

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike(`direct:${SOURCE}`), BOUND)
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ status: "running", counts: objectLike({ factsApplied: 1 }) }))

        // Part two settles later on its own, with its own truth under another key.
        const two = await build([proposalOf({ id: "f5", subjectKey: "gio-mo-cua", evidence: [{ kind: "document", ref: PART_TWO, label: "Doc (2/2)", sourceId: PART_TWO, chunkHash: "hash-z" }] })])
        two.parts.wholeOf.mockResolvedValue([SOURCE, PART_TWO])
        await expect(two.service.settle(docSourceOf({ id: PART_TWO, createdBy: "founder", status: "ready" }), [], STATE)).resolves.toBeNull()
        expect(two.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f5", "Founder", stringLike(`direct:${PART_TWO}`), BOUND)
    })


    it("a contradiction ACROSS parts on one key: neither value goes in force, whichever part settles first, and the founder is asked once (one choice of two waiting values)", async () => {
        const first = proposalOf()
        const second = proposalOf({ id: "f9", value: "25.000", valueNumber: 25_000, evidence: [{ kind: "document", ref: PART_TWO, label: "Doc (2/2)", sourceId: PART_TWO, chunkHash: "hash-z" }] })
        const settlePart = async (own: FactRecord, sourceId: string) => {
            const t = await build([own], { ...reviewed, reviewed: new Set([HASH, "hash-z"]) })
            t.parts.wholeOf.mockResolvedValue([SOURCE, PART_TWO])
            // Both values wait for the one key: the facts store answers them together, whatever part filed them.
            t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "proposed" ? [first, second] : []))
            await t.service.settle(docSourceOf({ id: sourceId, createdBy: "founder", status: "ready" }), [], STATE)
            return t
        }

        const one = await settlePart(first, SOURCE)
        const two = await settlePart(second, PART_TWO)

        expect(one.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(two.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(one.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
        expect(two.extractions.save).toHaveBeenCalledWith(WS, PART_TWO, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })


    it("a contradiction across parts in OTHER WORDS (the same-meaning judgement named the first value): the first value is contested and waits too", async () => {
        const first = proposalOf()
        const later = proposalOf({
            id: "f9",
            subjectKey: "ship-noi-thanh",
            value: "25.000",
            conflictWith: "f1",
            flags: ["same_meaning"],
            evidence: [{ kind: "document", ref: PART_TWO, label: "Doc (2/2)", sourceId: PART_TWO, chunkHash: "hash-z" }],
        })
        const t = await build([first])
        t.parts.wholeOf.mockResolvedValue([SOURCE, PART_TWO])
        t.reads.ofSources.mockImplementation((_ws, ids) => Promise.resolve(ids.includes(PART_TWO) ? [later] : [first]))

        await t.service.settle(founderDoc, [], STATE)

        expect(t.reads.ofSources).toHaveBeenCalledWith(WS, [PART_TWO], ["proposed"], 2000)
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })

})

describe("DocumentSettleService: what contests across the parts of one document", () => {
    it("contestedOf: only a DIFFERENT value contests; the same value in other words is a duplicate the settle closes", () => {
        const first = proposalOf()
        const differs = proposalOf({ id: "f9", subjectKey: "ship-noi-thanh", value: "25.000", conflictWith: "f1" })
        const same = proposalOf({ id: "f8", subjectKey: "ship-noi-thanh", value: "30.000", conflictWith: "f1" })
        // Two values of ONE key are the key's own question, decided by `arguesWith` (a window over a standing value argues with nothing).
        expect([...contestedOf([first, proposalOf({ id: "f7", value: "25.000", conflictWith: "f1" })])]).toEqual([])
        expect([...contestedOf([first, differs])]).toEqual(["f1"])
        expect([...contestedOf([first, same])]).toEqual([])
        // A truth named outside the document (a value in force) is the ordinary contradiction, not this rule.
        expect([...contestedOf([proposalOf({ conflictWith: "in-force" })])]).toEqual([])
    })


    it("contestedOf: a window linked to the document's standing value in other words is its overlay, never contested (D-N-5)", () => {
        const standing = proposalOf()
        const tet = proposalOf({
            id: "tet",
            subjectKey: "phi-ship-dip-tet",
            value: "50.000",
            validFrom: "2027-01-31T17:00:00.000Z",
            validTo: "2027-02-05T17:00:00.000Z",
            conflictWith: "f1",
        })
        expect([...contestedOf([standing, tet])]).toEqual([])
    })
})

const standing = proposalOf({ id: "now", status: "active", value: "30.000", decisionNote: `direct:${SOURCE} - In force from the founder's own document "Doc"` })
const windowOf = (more: Partial<FactRecord> = {}): FactRecord =>
    proposalOf({ id: "w1", value: "50.000", valueNumber: 50_000, validFrom: "2027-01-31T17:00:00.000Z", validTo: "2027-02-05T17:00:00.000Z", conflictWith: "now", ...more })
const onKey = (t: Awaited<ReturnType<typeof build>>, inForce: ReadonlyArray<FactRecord>, waiting: ReadonlyArray<FactRecord> = []) => {
    t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "active" ? [...inForce] : [...waiting]))
    t.facts.get.mockImplementation((_ws, id) => Promise.resolve(inForce.find((fact) => fact.id === id) ?? null))
}

describe("DocumentSettleService: a stated window is an overlay, a document updates itself, the founder's edit wins", () => {
    it("a holiday surcharge with from/to over the standing value in force is NOT a question: it goes in force for its window (the store puts the standing value back after it)", async () => {
        const foreign = { ...standing, sourceKind: "owner" as const, decisionNote: CHI_LAN_SUA_VI }
        const t = await build([windowOf()])
        onKey(t, [foreign])

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "w1", "Founder", stringLike(`direct:${SOURCE}`), BOUND)
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsApplied: 1, factsAsked: 0 }) }))
    })


    it("one document states the standing value AND a window over it: both go in force, the standing value first", async () => {
        const base = proposalOf({ id: "base", value: "5 %", valueNumber: 5 })
        const promo = windowOf({ id: "promo", value: "10 %", valueNumber: 10, conflictWith: null })
        const t = await build([promo, base])
        onKey(t, [], [base, promo])

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced.mock.calls.map(([, id]) => id)).toEqual(["base", "promo"])
    })


    it("an OPEN-ENDED other value against the value in force, and a window that overlaps another window with another value, are contradictions: the founder is asked", async () => {
        const foreign = { ...standing, sourceKind: "owner" as const, decisionNote: CHI_LAN_SUA_VI }
        const open = await build([proposalOf({ id: "open", value: "35.000", valueNumber: 35_000, conflictWith: "now" })])
        onKey(open, [foreign])
        await open.service.settle(founderDoc, [], STATE)
        expect(open.facts.applyUnannounced).not.toHaveBeenCalled()

        const other = windowOf({ id: "w2", value: "60.000", valueNumber: 60_000, validFrom: "2027-02-02T17:00:00.000Z", validTo: "2027-02-10T17:00:00.000Z", conflictWith: null })
        const overlap = await build([windowOf({ conflictWith: null })])
        onKey(overlap, [], [windowOf({ conflictWith: null }), other])
        await overlap.service.settle(founderDoc, [], STATE)
        expect(overlap.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(overlap.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))

        // Two windows that do not overlap (Tet, then 30/4) both apply.
        const later = windowOf({ id: "w3", value: "60.000", valueNumber: 60_000, validFrom: "2027-04-29T17:00:00.000Z", validTo: "2027-05-01T17:00:00.000Z", conflictWith: null })
        const apart = await build([windowOf({ conflictWith: null })])
        onKey(apart, [], [windowOf({ conflictWith: null }), later])
        await apart.service.settle(founderDoc, [], STATE)
        expect(apart.facts.applyUnannounced).toHaveBeenCalledTimes(1)
    })

})

describe("DocumentSettleService: the founder's edit wins over what a document says again", () => {
    it("v2 of the founder's own document changes a value v1 put in force: the document updates itself, the next version goes in force (note `updated:`), never refused for room", async () => {
        const t = await build([proposalOf({ id: "v2", value: "35.000", valueNumber: 35_000, conflictWith: "now" })])
        onKey(t, [standing])
        t.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })

        await expect(t.service.settle(founderDoc, [], STATE)).resolves.toBeNull()

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "v2", "Founder", stringLike(`updated:${SOURCE}`), BOUND)
    })


    it("the value in force no longer comes from that document (the founder edited it, or another source superseded it): his edit wins, the document's new value is a question", async () => {
        for (const now of [
            { ...standing, sourceKind: "owner" as const, decisionNote: CHI_LAN_SUA_TREN_TRANG_VI },
            { ...standing, decisionNote: "direct:another-document - In force from another document" },
        ]) {
            const t = await build([proposalOf({ id: "v2", value: "35.000", valueNumber: 35_000, conflictWith: "now" })])
            onKey(t, [now])
            await t.service.settle(founderDoc, [], STATE)
            expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
            // D-U-8: asked, and never closed as a duplicate of anything nor joined to the value in force (an old price table uploaded
            // after the founder's correction disagrees with HIS value).
            expect(t.facts.reject).not.toHaveBeenCalled()
            expect(t.facts.mergeDuplicate).not.toHaveBeenCalled()
            expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
        }
    })


    it("a held passage holds an update and an overlay like any truth", async () => {
        const t = await build([proposalOf({ id: "v2", value: "35.000", valueNumber: 35_000, conflictWith: "now" })], { ...reviewed, held: new Set([HASH]) })
        onKey(t, [standing])
        await t.service.settle(founderDoc, [], STATE)
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
    })
})

describe("DocumentSettleService: whose document it is (the one place)", () => {
    const publicDoc = docSourceOf({ createdBy: "manager", status: "ready", visibility: "public" })

    it("a public document is its APPROVER's: an owner-approved one goes in force in his name, whoever wrote or first published it", async () => {
        const t = await build([proposalOf()])
        t.publicDocuments.approverOf.mockResolvedValue("founder")

        await t.service.settle(publicDoc, [], STATE)

        expect(t.publicDocuments.approverOf).toHaveBeenCalledWith(WS, SOURCE)
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike("direct:"), BOUND)
    })

    it("manager-approved (D3: any member): it goes in force in the APPROVER's name, even when the founder created the source row", async () => {
        const t = await build([proposalOf()])
        t.publicDocuments.approverOf.mockResolvedValue("manager")

        await t.service.settle(docSourceOf({ createdBy: "founder", status: "ready", visibility: "public" }), [], STATE)

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Minh Manager", stringLike("put in by manager Minh Manager"), BOUND)
    })

    it("approved by someone who is no longer a member: its truths stay proposals", async () => {
        const t = await build([proposalOf()])
        t.publicDocuments.approverOf.mockResolvedValue("left-the-team")

        await t.service.settle(docSourceOf({ createdBy: "founder", status: "ready", visibility: "public" }), [], STATE)

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsWaiting: 1 }) }))
    })

    it("a document nobody stands behind (a sync, an API key) keeps its truths as proposals", async () => {
        const t = await build([proposalOf()])

        await t.service.settle(docSourceOf({ createdBy: null, status: "ready" }), [], STATE)

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
    })
})

describe("DocumentSettleService: before a truth goes in force by itself (TRIAGE-2)", () => {
    it("a truth another document put in force since it was filed, with the same value, closes it: nothing goes in force twice", async () => {
        const t = await build([proposalOf()])
        t.vectors.recheckBeforeForce.mockResolvedValue("duplicate")

        await t.service.settle(founderDoc, [], STATE)

        expect(t.vectors.recheckBeforeForce).toHaveBeenCalledWith(WS, objectLike({ id: "f1" }), new Set(["f1"]))
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
    })

    it("flagged with another value, the truth is judged again and asked", async () => {
        const t = await build([proposalOf()])
        t.vectors.recheckBeforeForce.mockResolvedValue("flagged")
        t.facts.get.mockImplementation((_workspace, id) =>
            id === "f1" ? Promise.resolve(proposalOf({ conflictWith: "other", flags: ["same_meaning"] })) : Promise.resolve(proposalOf({ id: "other", status: "active", value: "25.000" })),
        )

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })

    it("a window whose year the passage never wrote goes in force: no date question is asked any more (D2)", async () => {
        const window = proposalOf({ validFrom: "2027-10-17T17:00:00.000Z", validTo: "2027-10-20T17:00:00.000Z" })
        const t = await build([window])
        const passage = { id: "c1", order: 0, text: "Autumn tune-up from 18/10 to 20/10: 15% off every bicycle service", hash: HASH, triage: "rule" as const, triageVersion: 5, truthsVersion: 7 }

        await t.service.settle(founderDoc, [passage], STATE)

        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, "f1", "Founder", stringLike("direct:"), BOUND)
    })
})

describe("DocumentSettleService: contradictions across documents and no silent replacement (TRIAGE-4)", () => {
    it("a waiting truth of ANOTHER document naming this one with another value (the same-meaning link) makes it a question", async () => {
        const t = await build([proposalOf()])
        t.reads.kinOf.mockResolvedValue([proposalOf({ id: "r1", subjectKey: "phi-giao", value: "40.000", conflictWith: "f1" })])

        await t.service.settle(founderDoc, [], STATE)

        expect(t.reads.kinOf).toHaveBeenCalledWith(WS, { keys: [], ids: ["f1"] })
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })

    it("names the OTHER documents whose waiting truths this critique names, in an open point or an answer the founder gave", async () => {
        const point: OpenFinding = { id: "p", group: "g", kind: "contradicts", severity: "high", holds: true, hashes: [], factIds: ["f1", "r1"], namesAll: false }
        const named: PassageCritique = { ...reviewed, findings: [point], decided: new Map([["r2", { kind: "confirmed", by: "Owner" }]]) }
        const t = await build([], named)
        const other = (id: string, source: string) =>
            proposalOf({ id, evidence: [{ kind: "document", ref: source, label: "Other", sourceId: source, chunkHash: "h" }] })
        t.reads.byIds.mockResolvedValue([proposalOf(), other("r1", "doc-b"), other("r2", "doc-c")])

        await expect(t.service.otherSourcesNamedBy(WS, SOURCE)).resolves.toEqual(["doc-b", "doc-c"])
        expect(t.reads.byIds).toHaveBeenCalledWith(WS, ["f1", "r1", "r2"])
    })

    it("the same value already in force for the key: the truth joins it, nothing is written over the value in force", async () => {
        const t = await build([proposalOf()])
        const standing = proposalOf({ id: "a1", status: "active", value: "30.000", decisionNote: "direct:other" })
        t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "active" ? [standing] : []))
        t.facts.mergeDuplicate.mockResolvedValue(standing)

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.mergeDuplicate).toHaveBeenCalledWith(WS, "f1", "a1")
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
    })

    it("the same value in force while an open holding point names the truth: never joined, never closed as the same truth; it waits for the founder", async () => {
        const point: OpenFinding = { id: "point-b", group: "other_document", kind: "other_document", severity: "high", holds: true, hashes: [HASH], factIds: ["f1"], namesAll: true }
        const t = await build([proposalOf()], { ...reviewed, findings: [point] })
        const standing = proposalOf({ id: "a1", status: "active", value: "30.000", decisionNote: "direct:other" })
        t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "active" ? [standing] : []))
        t.facts.mergeDuplicate.mockResolvedValue(standing)

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.mergeDuplicate).not.toHaveBeenCalled()
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })

    it("the same key with another value WAITING from another document: asked, nothing in force", async () => {
        const rival = proposalOf({ id: "r1", value: "25.000", valueNumber: 25_000, evidence: [{ kind: "document", ref: "doc-b", label: "B", sourceId: "doc-b", chunkHash: "h" }] })
        const t = await build([proposalOf()])
        t.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) => Promise.resolve(status === "proposed" ? [proposalOf(), rival] : []))

        await t.service.settle(founderDoc, [], STATE)

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenCalledWith(WS, SOURCE, objectLike({ counts: objectLike({ factsAsked: 1 }) }))
    })
})
