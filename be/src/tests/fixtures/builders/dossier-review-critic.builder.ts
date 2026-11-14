import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, type MockOf } from "@starci/jest-preset"
import { BrainExtractionsService, type ExtractionRecord } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, factSlugOf, type FactRecord } from "@modules/domain/brain-facts"
import {
    DOSSIER_REVIEW_MESSAGES,
    DocumentCriticService,
    SHOP_TRUTH_CANDIDATES,
    type CritiqueBundle,
    type CritiqueChangedHook,
    type CritiqueFinding,
    type CritiquePointView,
    type CritiqueTry,
    type CritiqueView,
    type DocumentCriticModel,
    type ShopTruthCandidates,
    type TruthCandidate,
} from "@modules/domain/dossier-review"
import { CritiqueScopeService } from "@modules/domain/dossier-review/critique-scope.service"
import { DOCUMENT_CRITIC_MODEL } from "@modules/domain/dossier-review/document-critic.port"
import { DocumentCritiqueReadService } from "@modules/domain/dossier-review/document-critique-read.service"
import fx from "@modules/domain/dossier-review/document-critic.acceptance.fixtures.json"
import { UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeChunksService, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { CLAUSE_LEAD_VI, POLICY_BODY_VI, SECTION_WORD_VI } from "@tests/fixtures/i18n/dossier-review-spec.messages"
import { NOW, SRC, WS, World, worldError, type Row } from "@tests/fixtures/builders/dossier-review-world.builder"

/**
 * The world of the shop-document critic acceptance (lanes/brain-test-20261111: `tiem-hoa-quy-dinh.md` v1 and v2, deliberate defects
 * D1-D6; the text is copied in `document-critic.acceptance.fixtures.json`): an in-memory world the REAL services
 * (`DocumentCriticService`, `DocumentCritiqueReadService`) and the real policies run on (the in-memory world of
 * `dossier-review-world.builder`): the facts as the reading files them
 * (scripted), the shop's truths (the seeded small-basket price in force, as after TEST-PLAN step 0b), the candidate read supplying
 * meaning matches like BG2's `nearest` would, the real message catalog of the critic, and a SCRIPTED critic model (no real model call).
 */

/** A text of this many distinct sections of about 700 characters each (the Vietnamese policy text the index job cuts into passages). */
export const sectionsOf = (count: number): string =>
    Array.from(
        { length: count },
        (_, index) => `# ${SECTION_WORD_VI} ${String(index + 1)}\n\n${CLAUSE_LEAD_VI} ${String(index + 1)}: ${POLICY_BODY_VI.repeat(23)}`,
    ).join("\n\n")

/** The real catalog texts of the critic (Vietnamese), so the stored points read as the founder will read them. */
const CATALOG = mock<MessageCatalog>()
CATALOG.get.mockImplementation((key: string, params: Readonly<Record<string, string | number>>) =>
    Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        DOSSIER_REVIEW_MESSAGES.vi[key] ?? key,
    ),
)

// ---------------------------------------------------------------- facts as the reading files them (scripted)

type FactRow = ReadonlyArray<string>

/** The defaults of a fact the reading filed: a public product truth of the document. */
const factRecord = builder<FactRecord>({
    id: "f-0",
    subjectType: "product",
    subjectKey: "",
    subjectLabel: "",
    attribute: "",
    attributeLabel: "",
    value: "",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "NIVO",
    proposedAt: NOW.toISOString(),
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

/** A finished reading of the document, as the extraction store answers it. */
const extractionOf = builder<ExtractionRecord>({
    sourceId: SRC,
    status: "done",
    factsProposed: 0,
    promptVersion: 1,
    contentHash: null,
    windowsTotal: 0,
    windowsDone: 0,
    attempts: 1,
    orphanFactIds: [],
    passageHashes: [],
    factsChanged: false,
    stage: null,
    counts: { passagesTotal: 0, passagesTriaged: 0, passagesKept: 0, factsApplied: 0, factsAsked: 0, factsWaiting: 0 },
    windowsSkipped: 0,
    linesRefused: 0,
    updatedAt: NOW,
})

/** A fact as the reading files it (scripted), from a row of the fixtures. */
export const factOf = (world: World, row: FactRow, status: "proposed" | "active" = "proposed", own = true): FactRecord => {
    const [id = "", subjectLabel = "", attributeLabel = "", value = "", quote = ""] = row
    const chunk = own ? world.chunks.find((one) => one.content.includes(quote)) : undefined
    const evidence = own
        ? {
              kind: "document" as const,
              ref: SRC,
              label: fx.title,
              title: fx.title,
              quote,
              ...(chunk === undefined ? {} : { chunkHash: passageTextHashOf(chunk.content) }),
          }
        : { kind: "document" as const, ref: "seed-src", label: fx.seedTitle, title: fx.seedTitle, quote }
    return factRecord({
        id,
        subjectKey: factSlugOf(subjectLabel),
        subjectLabel,
        attribute: factSlugOf(attributeLabel),
        attributeLabel,
        value,
        status,
        evidence: [evidence],
    })
}

/** The facts of the first version. */
export const v1Facts = (world: World): Array<FactRecord> => fx.facts.map((row) => factOf(world, row))
/** The facts of the second version. */
export const v2Facts = (world: World): Array<FactRecord> => [...v1Facts(world), factOf(world, fx.rushFact)]

/** A waiting truth of a synthetic document of another trade, as a spec words it: its words and the line of the passage it was read from. */
export interface OwnTruth {
    readonly id: string
    readonly subjectLabel: string
    readonly attributeLabel: string
    readonly value: string
    readonly quote: string
}

/** A waiting truth the reading filed from a passage of the world's document, titled `title` (synthetic data, not the acceptance corpus). */
export const ownTruthOf = (world: World, truth: OwnTruth, title: string): FactRecord =>
    factRecord({
        id: truth.id,
        subjectKey: factSlugOf(truth.subjectLabel),
        subjectLabel: truth.subjectLabel,
        attribute: factSlugOf(truth.attributeLabel),
        attributeLabel: truth.attributeLabel,
        value: truth.value,
        evidence: [
            {
                kind: "document",
                ref: SRC,
                label: title,
                title,
                quote: truth.quote,
                chunkHash: passageTextHashOf(world.chunkWith(truth.quote).content),
            },
        ],
    })

// ---------------------------------------------------------------- the scripted critic model

/** The items of the named group of a critic bundle (the changed ones for any group that is not context, shop or facts). */
const itemsOf = (bundle: CritiqueBundle, group: string): CritiqueBundle["context"] => {
    if (group === "context") return bundle.context
    if (group === "shop") return bundle.shop
    if (group === "facts") return bundle.facts
    return bundle.changed
}

const keyOf = (bundle: CritiqueBundle, group: string, words: string): string => {
    const items = itemsOf(bundle, group)
    const found = items.find((item) => item.text.includes(words))
    if (found === undefined) throw worldError(`script: no ${group} item with ${words}`)
    return found.key
}

/** One finding of a scripted critic answer. */
export interface ScriptedFinding {
    readonly kind: string
    readonly severity: string
    readonly line: string
    readonly why: string
    readonly question: string
    readonly quotes: ReadonlyArray<ReadonlyArray<string>>
    readonly values: ReadonlyArray<string>
}

/** A scripted answer of the fixtures, its quotes cited by the keys this bundle gave. */
export const scripted = (bundle: CritiqueBundle, findings: ReadonlyArray<ScriptedFinding>): ReadonlyArray<CritiqueFinding> =>
    findings.map((finding) => ({
        ...finding,
        quotes: finding.quotes.map(([group = "", words = "", quote = ""]) => ({
            key: keyOf(bundle, group, words),
            quote,
        })),
    }))

/** A critic try that answered with these findings. */
export const answered = (findings: ReadonlyArray<CritiqueFinding>): CritiqueTry => ({
    ok: true,
    answer: { findings, model: "scripted", promptTokens: 1_000, completionTokens: 200 },
})

// ---------------------------------------------------------------- the services on the world

/** The scripted critic model and what it was asked, call by call. */
const scriptedModel = () => {
    const bundles: Array<CritiqueBundle> = []
    const script: Array<(bundle: CritiqueBundle) => CritiqueTry> = []
    const model = mock<DocumentCriticModel>()
    model.critique.mockImplementation((bundle: CritiqueBundle) => {
        bundles.push(bundle)
        const next = script.shift()
        return Promise.resolve(next === undefined ? { ok: false as const, reason: "unavailable" as const } : next(bundle))
    })
    return { bundles, script, model }
}

/** The shop's truths in force and the candidate read that matches the document's facts against them. */
const shopTruthsOf = (world: World): ShopTruthCandidates => {
    const truths = {
        basket: factOf(world, fx.truths.basket, "active", false),
        rose: factOf(world, fx.truths.rose, "active", false),
        hours: factOf(world, fx.truths.hours, "active", false),
    }
    const near = (fact: FactRecord): ReadonlyArray<TruthCandidate> => {
        if (fact.subjectKey === truths.basket.subjectKey) return [{ fact: truths.basket, distance: null, match: "key" }]
        if (fact.id === "f-rose") return [{ fact: truths.rose, distance: 0.08, match: "vector" }]
        if (fact.id === "f-hours") return [{ fact: truths.hours, distance: 0.12, match: "vector" }]
        return []
    }
    const candidates = mock<ShopTruthCandidates>()
    candidates.candidatesFor.mockImplementation((_ws: string, facts: ReadonlyArray<FactRecord>) =>
        Promise.resolve(new Map<string, ReadonlyArray<TruthCandidate>>(facts.map((fact) => [fact.id, near(fact)]))),
    )
    return candidates
}

/** The passages of the world as the knowledge store answers them. */
const chunksOf = (world: World): KnowledgeChunksService => {
    const chunks = mock<KnowledgeChunksService>()
    chunks.passagesOf.mockImplementation(() =>
        Promise.resolve(
            world.chunks.map((chunk, order) => ({ id: chunk.id, order, content: chunk.content, hasEmbedding: true })),
        ),
    )
    chunks.placesOf.mockResolvedValue(new Map())
    // What triage made of each passage, as the truths work stored it.
    chunks.truthPassagesOf.mockImplementation(() =>
        Promise.resolve(
            world.chunks.map((chunk, order) => ({
                id: chunk.id,
                order,
                text: chunk.content,
                hash: passageTextHashOf(chunk.content),
                triage: chunk.triage ?? null,
                triageVersion: chunk.triage === undefined ? null : 1,
                truthsVersion: null,
            })),
        ),
    )
    return chunks
}

/** The source, state, fact and extraction reads the critic makes about the document. */
const readsOf = (world: World) => {
    const states = mock<KnowledgeSourcesReadService>()
    states.statesOf.mockImplementation(() =>
        Promise.resolve([
            { id: SRC, title: fx.title, visibility: world.visibility, status: "ready", contentHash: null },
        ]),
    )
    const reads = mock<BrainFactsReadService>()
    reads.ofSources.mockImplementation(() => Promise.resolve(world.facts))
    const extractions = mock<BrainExtractionsService>()
    extractions.get.mockResolvedValue(extractionOf({ status: "done" }))
    states.briefsOf.mockResolvedValue([{ id: SRC, kind: "text", title: fx.title, topic: null }])
    return { states, reads, extractions }
}

/** The services on the world. */
export const buildCriticSubject = async (): Promise<Subject> => {
    const world = new World()
    const scriptedAnswers = scriptedModel()
    const chunks = chunksOf(world)
    const { states, reads, extractions } = readsOf(world)
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const vectorSync = mock<VectorSyncService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCriticService,
            CritiqueScopeService,
            DocumentCritiqueReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: world.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: MESSAGE_CATALOG, useValue: CATALOG },
            { provide: DOCUMENT_CRITIC_MODEL, useValue: scriptedAnswers.model },
            { provide: SHOP_TRUTH_CANDIDATES, useValue: shopTruthsOf(world) },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: UsageMeterService, useValue: usage },
            { provide: KnowledgeSourcesReadService, useValue: states },
            { provide: VectorSyncService, useValue: vectorSync },
        ],
    }).compile()
    const critic = moduleRef.get(DocumentCriticService)
    // The truths work listens to the critic (`DocumentFactsService.critiqued`): here a double that records what it was told.
    const hook = mock<CritiqueChangedHook>()
    hook.critiqued.mockImplementation((_workspaceId: string, _sourceId: string) => Promise.resolve(true))
    critic.whenChanged(hook)
    return { world, ...scriptedAnswers, usage, hook, vectorSync, critic, read: moduleRef.get(DocumentCritiqueReadService) }
}

/** Everything one spec drives. */
export interface Subject extends ReturnType<typeof scriptedModel> {
    /** The in-memory world the real services run on. */
    readonly world: World
    /** The usage meter double. */
    readonly usage: MockOf<UsageMeterService>
    /** The truths-work hook double: records what the critic told it. */
    readonly hook: MockOf<CritiqueChangedHook>
    /** The vector sync double. */
    readonly vectorSync: MockOf<VectorSyncService>
    /** The critic under test. */
    readonly critic: DocumentCriticService
    /** The read side of the critique. */
    readonly read: DocumentCritiqueReadService
}

/** One upload as the pipeline runs it: index job, reading (scripted facts), review request, review run. */
export const uploadAndReview = async (subject: Subject, text: string, facts: (world: World) => Array<FactRecord>): Promise<CritiqueView> => {
    subject.world.upload(text)
    subject.world.facts = facts(subject.world)
    await subject.critic.request(WS, SRC)
    await subject.critic.runWaiting(WS)
    const view = await subject.read.view(WS, SRC, ["open", "answered", "skipped", "gone"])
    if (view === null) throw worldError("no view")
    return view
}

/** A point as origin:group:kind:severity:state. */
export const brief = (point: CritiquePointView): string =>
    `${point.origin}:${point.group}:${point.kind}:${point.severity}:${point.state}`
/** True when the point quotes these words. */
export const quoting = (point: CritiquePointView, words: string): boolean =>
    point.quotes.some((quote) => quote.text.includes(words))
/** The point quoting these words (a live one first). */
export const pointWith = (points: ReadonlyArray<CritiquePointView>, words: string): CritiquePointView => {
    const found =
        points.find((point) => quoting(point, words) && point.state !== "gone") ??
        points.find((point) => quoting(point, words))
    if (found === undefined) throw worldError(`no point quoting ${words}`)
    return found
}

/** The critique row of the document under test (an empty row when there is none: the assertions on it then fail). */
export const rowOf = (subject: Subject): Row => subject.world.critiques.find((one) => one.sourceId === SRC) ?? {}
