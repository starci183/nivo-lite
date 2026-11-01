import { Test } from "@nestjs/testing"
import {
    REVIEW_NOW as NOW,
    REVIEW_WORKSPACE as WS,
    dossierReviewOf,
    mixedStoredFindings,
    reviewRunOf as runOf,
    runInState,
    storedFindingOf as storedOf,
    workspaceRunOf,
} from "@tests/fixtures/builders/dossier-review-runner.builder"
import { builder, FakeClock, fakeTransaction, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { UsageMeterService } from "@modules/domain/knowledge"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type { DocumentInput, DossierInputs, PackEntry, ReviewContext } from "./dossier-inputs.contracts"
import { DOSSIER_REASONER } from "./dossier-review.decorators"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import type { DossierBundle, DossierReasoner, ReasonedFinding, ReasonedReview } from "./dossier-review.port"
import { DossierReviewRunnerService, stateOf } from "./dossier-review-runner.service"
import { DossierFindingEntity, DossierReviewEntity, DossierReviewRunEntity } from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"

const PAYLOAD = { runId: "r1", workspaceId: WS }
const PASSAGE = "Ngay ky: [ ] thang 10 nam 2026 tai van phong cong ty"
const FINGERPRINT = /^[0-9a-f]{32}$/u

const docOf = builder<DocumentInput>({
    id: "s1",
    title: "Bien ban",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-10-01",
    updatedAt: "2026-10-30T00:00:00.000Z",
    chunkCount: 1,
    passages: [{ id: "p1", order: 0, text: PASSAGE }],
})

/** A document without blanks: the rules find nothing in it. */
const cleanDocOf = (id: string): DocumentInput => docOf({ id, passages: [{ id: `p-${id}`, order: 0, text: "Clean" }] })

const OPTIONAL_ENTRY: PackEntry = {
    ref: "4",
    nameHint: [],
    requirement: "optional",
    basis: [],
    expects: [],
    mustReflect: [],
    tracksExpiry: false,
    related: [],
    remedy: null,
}

const dossierOf = (id: string, position: number, documents: ReadonlyArray<DocumentInput>): DossierInputs => ({
    dossier: {
        id,
        ref: String(position),
        name: `Dossier ${position}`,
        category: "LEGAL",
        position,
        checklistStatus: "partial",
        existing: null,
        missing: null,
        drafts: null,
    },
    entry: null,
    documents,
    facts: [],
})

const contextOf = (dossiers: ReadonlyArray<DossierInputs>): ReviewContext => ({
    today: "2026-10-31",
    dossiers,
    activeFacts: [],
})

const findingOf = builder<ReasonedFinding>({
    kind: "unsigned",
    severity: "medium",
    title: "Thieu chu ky",
    detail: "Chua ky",
    evidence: [{ key: "S1.P1", quote: "thang 10 nam 2026" }],
    relatedRefs: [],
    remedyAction: "upload",
    documentType: null,
})

const reviewOf = builder<ReasonedReview>({
    findings: [],
    stillOpen: [],
    model: "m1",
    promptTokens: 100,
    completionTokens: 10,
})

/** What one spec's run sees. */
interface Setup {
    readonly run?: DossierReviewRunEntity | null
    readonly context: ReviewContext
    readonly targetIds: ReadonlyArray<string>
    readonly stored?: ReadonlyArray<DossierFindingEntity>
    readonly reviews?: ReadonlyArray<DossierReviewEntity>
    readonly daily?: unknown
    readonly blocked?: ReadonlyArray<boolean>
    readonly answers?: ReadonlyArray<ReasonedReview | null>
}

const build = async (setup: Setup) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [DossierReviewRunEntity, setup.run === undefined ? runOf() : setup.run],
            find: [
                [DossierFindingEntity, setup.stored ?? []],
                [DossierReviewEntity, setup.reviews ?? []],
            ],
            update: [
                [DossierReviewRunEntity, { affected: 1 }],
                [DossierFindingEntity, { affected: 1 }],
            ],
            insert: [DossierFindingEntity, {}],
            upsert: [DossierReviewEntity, {}],
        }),
    )
    const em: MockEntityManager = tx.em
    const daily = queueQueryBuilders(em, [{ getRawOne: setup.daily === undefined ? { calls: "3" } : setup.daily }])
    const inputs = mock<ReviewInputsService>()
    inputs.collect.mockResolvedValue({ context: setup.context, targetIds: setup.targetIds })
    const usage = mock<UsageMeterService>()
    for (const blocked of setup.blocked ?? []) usage.blockedBy.mockResolvedValueOnce(blocked)
    usage.blockedBy.mockResolvedValue(false)
    const reasoner = mock<DossierReasoner>()
    for (const answer of setup.answers ?? []) reasoner.review.mockResolvedValueOnce(answer)
    reasoner.review.mockResolvedValue(reviewOf())
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReviewRunnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: DOSSIER_REASONER, useValue: reasoner },
            { provide: ReviewInputsService, useValue: inputs },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(DossierReviewRunnerService), em, daily, inputs, usage, reasoner, logger }
}

/** The run update that ended the run. */
const endOf = (em: MockEntityManager): unknown =>
    em.update.mock.calls.filter((call) => call[0] === DossierReviewRunEntity).at(-1)?.[2]

/** The rows of the dossier states the run stored. */
const reviewRows = (em: MockEntityManager): ReadonlyArray<Record<string, unknown>> => {
    const rows: unknown = em.upsert.mock.calls[0]?.[1]
    return Array.isArray(rows) ? rows.filter(isRecord) : []
}

/** The characters a bundle carries, counted as the core counts its budget. */
const charsOf = (bundle: DossierBundle): number =>
    [
        ...bundle.documents.flatMap((doc) => [doc.title, ...doc.passages.map((item) => item.text)]),
        ...bundle.facts.map((item) => item.text),
        ...bundle.known.map((item) => item.text),
        ...bundle.openAi.map((item) => item.text),
    ].reduce((sum, text) => sum + text.length, 0)

const registerClaims = () => {
    it("drops a payload of another shape", async () => {
        const { service, logger, em } = await build({ context: contextOf([]), targetIds: [] })

        await expect(service.run({ draftId: "x" })).resolves.toBe("skipped")
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewLogEvent.PayloadRefused, { job: "review" })
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("skips a run that is gone, ended, or held by a live worker", async () => {
        const recent = new Date("2026-10-31T09:55:00.000Z")
        for (const run of [null, runInState("done", null), runInState("running", recent)]) {
            const { service, inputs } = await build({ run, context: contextOf([]), targetIds: [] })
            await expect(service.run(PAYLOAD)).resolves.toBe("skipped")
            expect(inputs.collect).not.toHaveBeenCalled()
        }
    })

    it("reclaims a running run whose worker has been silent and runs an empty pass", async () => {
        for (const startedAt of [null, new Date("2026-10-31T09:00:00.000Z")]) {
            const { service, em, inputs } = await build({
                run: workspaceRunOf("running", startedAt),
                context: contextOf([]),
                targetIds: [],
            })
            await expect(service.run(PAYLOAD)).resolves.toBe("done")
            expect(inputs.collect).toHaveBeenCalledWith(WS, null, "2026-10-31")
            expect(em.update).toHaveBeenNthCalledWith(
                1,
                DossierReviewRunEntity,
                { id: "r1", workspaceId: WS },
                { status: "running", startedAt: new Date(NOW) },
            )
            expect(em.find).toHaveBeenCalledTimes(1)
            expect(em.insert).not.toHaveBeenCalled()
            expect(em.upsert).not.toHaveBeenCalled()
            expect(endOf(em)).toEqual({
                status: "done",
                finishedAt: new Date(NOW),
                aiState: "skipped_unchanged",
                stats: {
                    opened: 0,
                    resolved: 0,
                    dropped: 0,
                    droppedReasons: {},
                    evaluated: 0,
                    aiCalls: 0,
                    promptTokens: 0,
                },
            })
        }
    })
}

const registerFindings = () => {
    it("stores the rule and model findings that verify and drops the rest", async () => {
        const { service, em, reasoner, logger, usage } = await build({
            context: contextOf([dossierOf("d1", 1, [docOf()])]),
            targetIds: ["d1"],
            answers: [
                reviewOf({
                    findings: [
                        findingOf(),
                        findingOf({ evidence: [{ key: "K9", quote: "nothing at all" }] }),
                        findingOf({ evidence: [{ key: "F9", quote: "nothing at all" }], title: "Second" }),
                    ],
                }),
            ],
        })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(reasoner.review.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: WS,
            documents: [{ key: "S1", passages: [{ key: "S1.P1", text: PASSAGE }] }],
            known: [{ key: "K1", text: "missing findings.signatures_placeholders.title" }],
        })
        expect(em.insert.mock.calls[0]?.[1]).toMatchObject([
            { origin: "rule", ruleKey: "signatures.placeholders", firstSeenRunId: "r1" },
            { origin: "ai", title: "Thieu chu ky", sourceIds: ["s1"] },
        ])
        expect(logger.info).toHaveBeenCalledWith(DossierReviewLogEvent.CandidatesDropped, {
            runId: "r1",
            reasons: { no_evidence: 2 },
        })
        expect(reviewRows(em)).toMatchObject([
            { dossierId: "d1", status: "present", openCount: 0, actualDocuments: 1, lastRunId: "r1" },
        ])
        expect(reviewRows(em)[0]?.inputsFingerprint).toMatch(FINGERPRINT)
        expect(endOf(em)).toMatchObject({
            aiState: "done",
            stats: { opened: 2, dropped: 2, aiCalls: 1, promptTokens: 100, evaluated: 1 },
        })
    })

    it("leaves an unchanged dossier to its stored model findings and keeps its fingerprint", async () => {
        const dossier = dossierOf("d1", 1, [docOf()])
        const first = await build({ context: contextOf([dossier]), targetIds: ["d1"] })
        await first.service.run(PAYLOAD)
        const fingerprint = reviewRows(first.em)[0]?.inputsFingerprint
        const known = typeof fingerprint === "string" ? fingerprint : ""
        const { service, em, reasoner } = await build({
            context: contextOf([dossier]),
            targetIds: ["d1"],
            stored: [storedOf()],
            reviews: [dossierReviewOf({ inputsFingerprint: known })],
        })

        await service.run(PAYLOAD)

        expect(reasoner.review).not.toHaveBeenCalled()
        expect(reviewRows(em)[0]?.inputsFingerprint).toBe(known)
        expect(em.update.mock.calls.filter((call) => call[0] === DossierFindingEntity)).toEqual([])
        expect(endOf(em)).toMatchObject({ aiState: "skipped_unchanged" })
    })
}

const RESOLVED = {
    lastSeenRunId: "r1",
    lastSeenAt: new Date(NOW),
    status: "resolved",
    resolution: "document",
    resolvedAt: new Date(NOW),
}

const registerResolutions = () => {
    it("resolves an open model finding only with newer verified evidence, and counts the bundle when the model gives no tokens", async () => {
        const { service, em, reasoner } = await build({
            context: contextOf([dossierOf("d1", 1, [docOf()])]),
            targetIds: ["d1"],
            stored: mixedStoredFindings(),
            reviews: [dossierReviewOf()],
            answers: [
                reviewOf({
                    promptTokens: null,
                    stillOpen: [
                        { key: "A1", applies: false, evidence: [{ key: "S1.P1", quote: "thang 10 nam 2026" }] },
                        { key: "A2", applies: true, evidence: [] },
                    ],
                }),
            ],
        })

        await service.run(PAYLOAD)

        const bundle = reasoner.review.mock.calls[0]?.[0]
        expect(bundle).toMatchObject({
            openAi: [
                { key: "A1", text: "Old - Old detail" },
                { key: "A2", text: "Kept - Old detail" },
            ],
        })
        expect(em.update).toHaveBeenCalledWith(DossierFindingEntity, { id: "f1", workspaceId: WS }, RESOLVED)
        expect(em.update).toHaveBeenCalledWith(DossierFindingEntity, { id: "f4", workspaceId: WS }, RESOLVED)
        const tokens = bundle === undefined ? 0 : Math.ceil(charsOf(bundle) / 4)
        expect(tokens).toBeGreaterThan(0)
        expect(endOf(em)).toMatchObject({ stats: { promptTokens: tokens } })
    })
}

const registerCredits = () => {
    it("stops at the credits, reads the most severe dossier first and skips a dossier without documents", async () => {
        const severe = dossierOf("d2", 2, [docOf({ id: "s2", passages: [{ id: "p2", order: 0, text: PASSAGE }] })])
        const empty: DossierInputs = { ...dossierOf("d4", 4, []), entry: OPTIONAL_ENTRY }
        const { service, em, usage, reasoner } = await build({
            run: workspaceRunOf(),
            context: contextOf([
                dossierOf("d1", 1, [cleanDocOf("s1")]),
                severe,
                dossierOf("d3", 3, [cleanDocOf("s3")]),
                empty,
            ]),
            targetIds: ["d1", "d2", "d3", "d4"],
            blocked: [false, true],
        })

        await service.run(PAYLOAD)

        expect(usage.blockedBy).toHaveBeenCalledTimes(2)
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", true)
        expect(reasoner.review).toHaveBeenCalledTimes(1)
        expect(reasoner.review.mock.calls[0]?.[0]).toMatchObject({ dossier: { ref: "2" } })
        const rows = reviewRows(em)
        expect(rows.map((row) => row.inputsFingerprint === null)).toEqual([true, false, true, true])
        expect(rows[3]).toMatchObject({ dossierId: "d4", status: "partial" })
        expect(endOf(em)).toMatchObject({ aiState: "partial" })
    })

    it("marks the model pass failed when the model cannot answer, and keeps the rule findings", async () => {
        const { service, em, logger } = await build({
            context: contextOf([dossierOf("d1", 1, [docOf()])]),
            targetIds: ["d1"],
            answers: [null],
        })

        await service.run(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(DossierReviewLogEvent.ModelUnavailable, {
            runId: "r1",
            dossierId: "d1",
        })
        expect(em.insert.mock.calls[0]?.[1]).toMatchObject([{ origin: "rule" }])
        expect(endOf(em)).toMatchObject({ aiState: "failed" })
    })
}

const registerCaps = () => {
    it("stops at the daily allowance counted from the runs", async () => {
        const { service, em, daily, reasoner } = await build({
            context: contextOf([dossierOf("d1", 1, [docOf()])]),
            targetIds: ["d1"],
            daily: { calls: 150 },
        })

        await service.run(PAYLOAD)

        expect(reasoner.review).not.toHaveBeenCalled()
        expect(daily[0]?.callsOf("select")).toEqual([
            ["COALESCE(SUM(CAST(r.stats->>'aiCalls' AS integer)), 0)", "calls"],
        ])
        expect(daily[0]?.callsOf("where")).toEqual([
            [
                "r.workspaceId = :workspaceId AND r.createdAt >= :since",
                { workspaceId: WS, since: new Date("2026-10-30T10:00:00.000Z") },
            ],
        ])
        expect(endOf(em)).toMatchObject({ aiState: "skipped_budget" })
    })

    it("stops at the prompt tokens of a run, and reads no count as no calls", async () => {
        const one = dossierOf("d1", 1, [docOf()])
        const two = dossierOf("d2", 2, [docOf({ id: "s2", passages: [{ id: "p2", order: 0, text: PASSAGE }] })])
        const { service, em, reasoner } = await build({
            run: workspaceRunOf(),
            context: contextOf([one, two]),
            targetIds: ["d1", "d2"],
            answers: [reviewOf({ promptTokens: 600_000 })],
        })
        await service.run(PAYLOAD)
        expect(reasoner.review).toHaveBeenCalledTimes(1)
        expect(endOf(em)).toMatchObject({ aiState: "partial" })

        const quiet = await build({ context: contextOf([one]), targetIds: ["d1"], daily: null })
        await quiet.service.run(PAYLOAD)
        expect(quiet.reasoner.review).toHaveBeenCalledTimes(1)
    })

    it("stops after 80 calls in one run", async () => {
        const dossiers = Array.from({ length: 81 }, (_, index) =>
            dossierOf(`d${index}`, index, [cleanDocOf(`s${index}`)]),
        )
        const { service, reasoner, em } = await build({
            run: workspaceRunOf(),
            context: contextOf(dossiers),
            targetIds: dossiers.map((inputs) => inputs.dossier.id),
            daily: { calls: 0 },
        })

        await service.run(PAYLOAD)

        expect(reasoner.review).toHaveBeenCalledTimes(80)
        expect(endOf(em)).toMatchObject({ aiState: "partial" })
    })
}

describe("DossierReviewRunnerService run", () => {
    registerClaims()
    registerFindings()
    registerResolutions()
    registerCredits()
    registerCaps()
})

describe("DossierReviewRunnerService fail", () => {
    it("ends a queued or running run failed, and ignores a payload of another shape", async () => {
        const { service, em } = await build({ context: contextOf([]), targetIds: [] })

        await service.fail({ nope: true })
        await service.fail(PAYLOAD)

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(
            DossierReviewRunEntity,
            { id: "r1", workspaceId: WS, status: In(["queued", "running"]) },
            { status: "failed", finishedAt: new Date(NOW), error: "job_failed" },
        )
    })
})

describe("stateOf", () => {
    const tally = { changed: 2, read: 0, failed: 0, calls: 0, tokens: 0, credits: false, budget: false }

    it("names what the model pass did", () => {
        expect(stateOf({ ...tally, changed: 0 })).toBe("skipped_unchanged")
        expect(stateOf({ ...tally, read: 2 })).toBe("done")
        expect(stateOf({ ...tally, read: 1 })).toBe("partial")
        expect(stateOf({ ...tally, credits: true })).toBe("skipped_credits")
        expect(stateOf({ ...tally, budget: true })).toBe("skipped_budget")
        expect(stateOf({ ...tally, failed: 2 })).toBe("failed")
    })
})
