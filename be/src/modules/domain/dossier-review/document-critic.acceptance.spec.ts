/**
 * ACCEPTANCE of the shop-document critic over the brain test documents (lanes/brain-test-20261111: `tiem-hoa-quy-dinh.md` v1 and v2,
 * deliberate defects D1-D6; the text is copied in `document-critic.acceptance.fixtures.json`), through the REAL services
 * (`DocumentCriticService`, `DocumentCritiqueReadService`) and the real policies, on an in-memory world: the passages as the index job
 * cuts them (`chunkPassages`, unchanged passages keep their row as `arrange` does), the facts as the reading files them (scripted), the
 * shop's truths (the seeded small-basket price in force, as after TEST-PLAN step 0b), the candidate read supplying meaning matches like
 * BG2's `nearest` would, the real message catalog of the critic, and a SCRIPTED critic model (no real model call).
 */
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { FindOperator } from "typeorm"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, factSlugOf } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeChunksService, chunkPassages, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import fx from "./document-critic.acceptance.fixtures.json"
import { DOCUMENT_CRITIC_MODEL, SHOP_TRUTH_CANDIDATES } from "./document-critic.port"
import type { CritiqueBundle, CritiqueFinding, CritiqueTry, DocumentCriticModel, ShopTruthCandidates, TruthCandidate } from "./document-critic.port"
import { DocumentCriticService } from "./document-critic.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import type { CritiquePointView } from "./document-critique-read.service"
import { DOSSIER_REVIEW_MESSAGES } from "./messages/dossier-review.messages"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const SRC = "22222222-2222-4222-8222-222222222222"
const OWNER = "33333333-3333-4333-8333-333333333333"
const NOW = new Date("2026-11-11T10:00:00.000Z")
const W = fx.words

const V1 = fx.v1
const V2 = V1.replace(fx.oldRush, fx.newRush)
const V3 = V2.replace(fx.oldCash, fx.newCash)

/** The real catalog texts of the critic (Vietnamese), so the stored points read as the founder will read them. */
const CATALOG = mock<MessageCatalog>({
    get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) =>
        Object.entries(params).reduce(
            (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
            DOSSIER_REVIEW_MESSAGES.vi[key] ?? key,
        ),
    ),
})

// ---------------------------------------------------------------- the in-memory world

type Row = Record<string, unknown>
interface Chunk {
    id: string
    content: string
    customerReady: boolean
}
const matches = (value: unknown, wanted: unknown): boolean => {
    if (!(wanted instanceof FindOperator)) return value === wanted
    const inner: unknown = wanted.value
    switch (wanted.type) {
        case "in":
            return Array.isArray(inner) && inner.includes(value)
        case "isNull":
            return value === null || value === undefined
        case "like":
            return typeof value === "string" && typeof inner === "string" && value.startsWith(inner.replace(/%$/u, ""))
        case "arrayContains":
            return Array.isArray(value) && Array.isArray(inner) && inner.every((one) => value.includes(one))
        case "lessThan":
            return value instanceof Date && inner instanceof Date && value.getTime() < inner.getTime()
        case "moreThanOrEqual":
            return value instanceof Date && inner instanceof Date && value.getTime() >= inner.getTime()
        case "not":
            return !matches(value, inner)
        default:
            throw new Error(`world: operator ${wanted.type}`)
    }
}

/** The query builder chain the critic uses. */
interface Builder {
    insert: () => Builder
    into: (entity: unknown) => Builder
    values: (values: Row) => Builder
    orIgnore: () => Builder
    update: (entity: unknown) => Builder
    set: (set: Row) => Builder
    where: (where: string, params: Row) => Builder
    execute: () => Promise<unknown>
}

class World {
    readonly critiques: Array<Row> = []
    readonly findings: Array<Row> = []
    chunks: Array<Chunk> = []
    facts: Array<FactRecord> = []
    private seq = 0

    nextId(prefix: string): string {
        this.seq += 1
        return `${prefix}-${String(this.seq).padStart(4, "0")}`
    }

    tableOf(entity: unknown): Array<Row> {
        if (entity === SourceCritiqueEntity) return this.critiques
        if (entity === DossierFindingEntity) return this.findings
        throw new Error("world: unknown entity")
    }

    rowsWhere(entity: unknown, where: Row): Array<Row> {
        return this.tableOf(entity).filter((row) => Object.entries(where).every(([key, wanted]) => matches(row[key], wanted)))
    }

    /** The index job: the passages of a text, an unchanged passage keeping its row (and its gate), a new one withheld. */
    upload(text: string): void {
        const old = this.chunks
        this.chunks = chunkPassages(text).map((content) => old.find((chunk) => chunk.content === content) ?? { id: this.nextId("c"), content, customerReady: false })
    }

    chunkWith(words: string): Chunk {
        const found = this.chunks.find((chunk) => chunk.content.includes(words))
        if (found === undefined) throw new Error(`world: no passage with ${words}`)
        return found
    }

    readonly em: Readonly<Record<string, jest.Mock>> = {
        update: jest.fn((entity: unknown, where: Row, set: Row) => {
            const rows = this.rowsWhere(entity, where)
            for (const row of rows) Object.assign(row, set, { updatedAt: NOW })
            return Promise.resolve({ affected: rows.length })
        }),
        find: jest.fn((entity: unknown, options: { where: Row; take?: number }) => Promise.resolve(this.rowsWhere(entity, options.where).slice(0, options.take ?? 10_000))),
        findOne: jest.fn((entity: unknown, options: { where: Row }) => Promise.resolve(this.rowsWhere(entity, options.where)[0] ?? null)),
        findOneOrFail: jest.fn((entity: unknown, options: { where: Row }) => {
            const [row] = this.rowsWhere(entity, options.where)
            return row === undefined ? Promise.reject(new Error("not found")) : Promise.resolve(row)
        }),
        exists: jest.fn((entity: unknown, options: { where: Row }) => Promise.resolve(this.rowsWhere(entity, options.where).length > 0)),
        insert: jest.fn((entity: unknown, rows: ReadonlyArray<Row>) => {
            for (const row of rows) {
                this.tableOf(entity).push({
                    id: this.nextId("f"),
                    status: "open",
                    resolution: null,
                    resolvedAt: null,
                    reopenedCount: 0,
                    decidedAt: null,
                    decidedBy: null,
                    decisionNote: null,
                    dismissReason: null,
                    createdAt: NOW,
                    updatedAt: NOW,
                    ...row,
                })
            }
            return Promise.resolve({})
        }),
        transaction: jest.fn(<T>(work: (tx: unknown) => Promise<T>) => work(this.em)),
        query: jest.fn((sql: string, params: ReadonlyArray<unknown>) => {
            if (sql.startsWith("UPDATE public.knowledge_chunks")) {
                const ready = params[2] as ReadonlyArray<string>
                for (const chunk of this.chunks) chunk.customerReady = ready.includes(chunk.id)
                return Promise.resolve([])
            }
            if (sql.startsWith("SELECT count(*)")) {
                return Promise.resolve([{ total: this.chunks.length, ready: this.chunks.filter((chunk) => chunk.customerReady).length }])
            }
            throw new Error(`world: sql ${sql}`)
        }),
        createQueryBuilder: jest.fn(() => {
            const state: { entity?: unknown; values?: Row; where?: string; params?: Row; set?: Row } = {}
            const builder: Builder = {
                insert: () => builder,
                into: (entity: unknown) => ((state.entity = entity), builder),
                values: (values: Row) => ((state.values = values), builder),
                orIgnore: () => builder,
                update: (entity: unknown) => ((state.entity = entity), builder),
                set: (set: Row) => ((state.set = set), builder),
                where: (where: string, params: Row) => ((state.where = where), (state.params = params), builder),
                execute: () => {
                    if (state.values !== undefined) {
                        const table = this.tableOf(state.entity)
                        if (!table.some((row) => row.sourceId === state.values?.sourceId)) {
                            table.push({ id: this.nextId("q"), reviewedHashes: [], modelCalls: 0, promptTokens: 0, startedAt: null, finishedAt: null, ...state.values })
                        }
                        return Promise.resolve({})
                    }
                    if (state.where?.includes("requestedAt > startedAt") === true) {
                        for (const row of this.rowsWhere(state.entity, { workspaceId: state.params?.workspaceId, sourceId: state.params?.sourceId })) {
                            const requested = row.requestedAt as Date
                            const started = row.startedAt as Date | null
                            if (started !== null && requested.getTime() > started.getTime()) Object.assign(row, state.set)
                        }
                        return Promise.resolve({})
                    }
                    throw new Error(`world: builder ${state.where ?? ""}`)
                },
            }
            return builder
        }),
    }
}

// ---------------------------------------------------------------- facts as the reading files them (scripted)

type FactRow = ReadonlyArray<string>

const factOf = (world: World, row: FactRow, status: "proposed" | "active" = "proposed", own = true): FactRecord => {
    const [id = "", subjectLabel = "", attributeLabel = "", value = "", quote = ""] = row
    const chunk = own ? world.chunks.find((one) => one.content.includes(quote)) : undefined
    const evidence = own
        ? { kind: "document", ref: SRC, label: fx.title, title: fx.title, quote, chunkHash: chunk === undefined ? undefined : passageTextHashOf(chunk.content) }
        : { kind: "document", ref: "seed-src", label: fx.seedTitle, title: fx.seedTitle, quote }
    const record = {
        id,
        subjectType: "product",
        subjectKey: factSlugOf(subjectLabel),
        subjectLabel,
        attribute: factSlugOf(attributeLabel),
        attributeLabel,
        value,
        valueNumber: null,
        unit: null,
        scope: "public",
        modules: [],
        installationId: null,
        status,
        sourceKind: "document",
        trust: 75,
        validFrom: null,
        validTo: null,
        supersedesId: null,
        conflictWith: null,
        proposalKind: "set",
        evidence: [evidence],
        proposedBy: "NIVO",
        proposedAt: NOW.toISOString(),
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
    }
    return record as FactRecord
}

const v1Facts = (world: World): Array<FactRecord> => fx.facts.map((row) => factOf(world, row))
const v2Facts = (world: World): Array<FactRecord> => [...v1Facts(world), factOf(world, fx.rushFact)]

// ---------------------------------------------------------------- the scripted critic model

const keyOf = (bundle: CritiqueBundle, group: string, words: string): string => {
    const items = group === "context" ? bundle.context : group === "shop" ? bundle.shop : group === "facts" ? bundle.facts : bundle.changed
    const found = items.find((item) => item.text.includes(words))
    if (found === undefined) throw new Error(`script: no ${group} item with ${words}`)
    return found.key
}

interface ScriptedFinding {
    readonly kind: string
    readonly severity: string
    readonly line: string
    readonly why: string
    readonly question: string
    readonly quotes: ReadonlyArray<ReadonlyArray<string>>
    readonly values: ReadonlyArray<string>
}

/** A scripted answer of the fixtures, its quotes cited by the keys this bundle gave. */
const scripted = (bundle: CritiqueBundle, findings: ReadonlyArray<ScriptedFinding>): ReadonlyArray<CritiqueFinding> =>
    findings.map((finding) => ({
        ...finding,
        quotes: finding.quotes.map(([group = "", words = "", quote = ""]) => ({ key: keyOf(bundle, group, words), quote })),
    }))

const answered = (findings: ReadonlyArray<CritiqueFinding>): CritiqueTry => ({
    ok: true,
    answer: { findings, model: "scripted", promptTokens: 1_000, completionTokens: 200 },
})

// ---------------------------------------------------------------- the services on the world

const build = async () => {
    const world = new World()
    const bundles: Array<CritiqueBundle> = []
    const script: Array<(bundle: CritiqueBundle) => CritiqueTry> = []
    const model: DocumentCriticModel = {
        critique: jest.fn((bundle: CritiqueBundle) => {
            bundles.push(bundle)
            const next = script.shift()
            return Promise.resolve(next === undefined ? { ok: false as const, reason: "unavailable" as const } : next(bundle))
        }),
    }
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
    const candidates: ShopTruthCandidates = {
        candidatesFor: jest.fn((_ws: string, facts: ReadonlyArray<FactRecord>) =>
            Promise.resolve(new Map<string, ReadonlyArray<TruthCandidate>>(facts.map((fact) => [fact.id, near(fact)]))),
        ),
    }
    const chunks = mock<KnowledgeChunksService>()
    chunks.passagesOf.mockImplementation(() =>
        Promise.resolve(world.chunks.map((chunk, order) => ({ id: chunk.id, order, content: chunk.content, hasEmbedding: true }))),
    )
    chunks.placesOf.mockResolvedValue(new Map())
    const reads = mock<BrainFactsReadService>()
    reads.ofSources.mockImplementation(() => Promise.resolve(world.facts))
    const extractions = mock<BrainExtractionsService>()
    extractions.get.mockResolvedValue({ status: "done" } as Awaited<ReturnType<BrainExtractionsService["get"]>>)
    const sources = mock<DossierSourcesService>()
    sources.sourceOf.mockResolvedValue({
        id: SRC,
        title: fx.title,
        topic: null,
        tags: [],
        origin: null,
        kind: "text",
        status: "ready",
        chunkCount: 8,
        sizeBytes: 1,
        updatedAt: NOW.toISOString(),
        createdAt: NOW.toISOString(),
    })
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCriticService,
            DocumentCritiqueReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: world.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: MESSAGE_CATALOG, useValue: CATALOG },
            { provide: DOCUMENT_CRITIC_MODEL, useValue: model },
            { provide: SHOP_TRUTH_CANDIDATES, useValue: candidates },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: DossierSourcesService, useValue: sources },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { world, bundles, script, model, usage, critic: moduleRef.get(DocumentCriticService), read: moduleRef.get(DocumentCritiqueReadService) }
}

type Subject = Awaited<ReturnType<typeof build>>

/** One upload as the pipeline runs it: index job, reading (scripted facts), review request, review run. */
const uploadAndReview = async (subject: Subject, text: string, facts: (world: World) => Array<FactRecord>) => {
    subject.world.upload(text)
    subject.world.facts = facts(subject.world)
    await subject.critic.request(WS, SRC)
    await subject.critic.runWaiting(WS)
    const view = await subject.read.view(WS, SRC, ["open", "answered", "skipped", "gone"])
    if (view === null) throw new Error("no view")
    return view
}

const brief = (point: CritiquePointView): string => `${point.origin}:${point.group}:${point.kind}:${point.severity}:${point.state}`
const quoting = (point: CritiquePointView, words: string): boolean => point.quotes.some((quote) => quote.text.includes(words))
const pointWith = (points: ReadonlyArray<CritiquePointView>, words: string): CritiquePointView => {
    const found = points.find((point) => quoting(point, words) && point.state !== "gone") ?? points.find((point) => quoting(point, words))
    if (found === undefined) throw new Error(`no point quoting ${words}`)
    return found
}

describe("shop-document critic: acceptance over tiem-hoa-quy-dinh v1 -> v2", () => {
    it("v1 (first upload): every deliberate defect becomes a point; six by the rules alone, three by the ONE model call; the guard drops a repeat and a made-up quote; customer-facing passages are held only under open high points", async () => {
        const subject = await build()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        const view = await uploadAndReview(subject, V1, v1Facts)

        expect(subject.world.chunks).toHaveLength(8)
        expect(subject.model.critique).toHaveBeenCalledTimes(1)
        const [bundle] = subject.bundles
        expect(bundle?.firstUpload).toBe(true)
        expect(bundle?.changed).toHaveLength(8)
        expect(bundle?.context).toEqual([])
        expect(bundle?.facts).toHaveLength(12)
        expect(bundle?.shop.map((item) => item.text)).toEqual(fx.shopLines.map((line) => `${line} [in force · ${fx.seedTitle}]`))
        expect(bundle?.known.length).toBe(6)

        const by = (words: string): string => brief(pointWith(view.points, words))
        // Rules alone (no model): D1, D2, D3, D3b, D4a, D5.
        expect(by(W.fee30)).toBe("rule:inside:inside_contradiction:high:open") // D1
        expect(by(W.rush)).toBe("rule:unclear:vague:medium:open") // D2
        expect(by(W.tet)).toBe("rule:stale:stale_date:low:open") // D3
        expect(by(W.loyalEnd)).toBe("rule:stale:stale_date:high:open") // D3b
        expect(by(W.stand)).toBe("rule:unclear:template:medium:open") // D4a
        expect(by(W.basketTruth)).toBe("rule:shop:shop_contradiction:high:open") // D5 (needs the seeded value in force: step 0b)
        // The model, from meaning: D4b, D5b, D5c.
        expect(by(W.intro)).toBe("ai:unclear:missing:medium:open") // D4b
        expect(by(W.rose)).toBe("ai:shop:shop_contradiction:high:open") // D5b
        expect(by(W.hoursLine)).toBe("ai:shop:shop_contradiction:high:open") // D5c
        expect(view.points).toHaveLength(9)
        expect(view.counts).toEqual({ open: 9, high: 5, answered: 0, skipped: 0, gone: 0 })

        const d5b = pointWith(view.points, W.rose)
        expect(d5b.against).toEqual({ kind: "truth", value: fx.truths.rose[3], sourceTitle: fx.seedTitle, factId: "t-rose" })
        expect(d5b.choices.map((choice) => [choice.answer.kind, choice.answer.factId])).toEqual([
            ["keep_document", "f-rose"],
            ["keep_shop", "t-rose"],
        ])
        const d1 = pointWith(view.points, W.fee30)
        expect(d1.choices.map((choice) => [choice.answer.kind, choice.answer.factId])).toEqual([
            ["pick", "f-ship30"],
            ["pick", "f-ship25"],
        ])
        expect(d1.line).toBe(DOSSIER_REVIEW_MESSAGES.vi["critic.inside.line"]?.replace("{{label}}", W.fee30.split(":")[0] ?? ""))

        expect(view.review).toEqual(expect.objectContaining({ state: "done", reason: null, attempts: 1 }))
        // Held: the two fee passages (D1), the price list (D5, D5b), opening hours (D5c), regulars (D3b). Served: intro, rush, payment.
        const ready = (words: string): boolean => subject.world.chunkWith(words).customerReady
        expect([ready(W.intro), ready(W.rush), ready(W.payment)]).toEqual([true, true, true])
        expect([ready(W.fee30), ready(W.fee25), ready(W.basket), ready(W.hours), ready(W.loyalEndShort)]).toEqual([false, false, false, false, false])
        expect(view.serving).toEqual({ state: "partly", withheldPassages: 5, totalPassages: 8 })
    })

    it("v2 (one paragraph changed): ONE model call that reads only the changed passage and its new fact; answered and skipped points keep their state; the vague rule whose passage is gone closes itself; model points on unchanged passages stay; an identical re-upload costs no call", async () => {
        const subject = await build()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        const first = await uploadAndReview(subject, V1, v1Facts)
        // The founder answers D1 (the 30.000 value) and skips D5, before the new version.
        const d1 = pointWith(first.points, W.fee30)
        const d5 = pointWith(first.points, W.basketTruth)
        await subject.read.recordAnswer(WS, d1.id, { answer: { kind: "pick", factId: "f-ship30", value: W.pick30 }, proposalFactId: "f-ship30", by: OWNER, note: null })
        await subject.read.skip(WS, d5.id, OWNER, W.skipReason)
        expect(subject.world.chunkWith(W.fee30).customerReady).toBe(true)
        const statesBefore = new Map(first.points.map((point) => [point.id, point.state]))
        const passagesBefore = subject.world.chunks.map((chunk) => chunk.id)

        subject.script.push((bundle) => answered(scripted(bundle, fx.v2Answer)))
        const second = await uploadAndReview(subject, V2, v2Facts)

        // The index kept 7 of 8 passages; the critic read ONE.
        expect(subject.world.chunks.map((chunk) => chunk.id).filter((id) => passagesBefore.includes(id))).toHaveLength(7)
        expect(subject.model.critique).toHaveBeenCalledTimes(2)
        const bundle = subject.bundles[1]
        expect(bundle?.firstUpload).toBe(false)
        expect(bundle?.changed.map((item) => item.text)).toEqual([expect.stringContaining(fx.newRush)])
        expect(bundle?.context).toHaveLength(7)
        expect(bundle?.facts.map((item) => item.text)).toEqual([fx.rushFactLine])

        const state = (words: string): string => pointWith(second.points, words).state
        expect(state(W.fee30)).toBe("answered") // D1 kept its answer
        expect(state(W.basketTruth)).toBe("skipped") // D5 kept its skip
        expect(state(W.rush)).toBe("gone") // D2: its passage is no longer in the document
        expect(pointWith(second.points, W.rush).id).toBe(pointWith(first.points, W.rush).id)
        for (const words of [W.intro, W.rose, W.hoursLine, W.loyalEndShort, W.tetShort, W.bracket]) {
            const point = pointWith(second.points, words)
            expect([words, statesBefore.get(point.id), point.state]).toEqual([words, "open", "open"])
        }
        expect(second.points).toHaveLength(9)
        expect(second.counts).toEqual({ open: 6, high: 3, answered: 1, skipped: 1, gone: 1 })
        expect(subject.world.chunkWith(fx.newRush).customerReady).toBe(true)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(false) // D5b still open on the price list

        // The same text again: nothing changed, no call, the critique stays done.
        const third = await uploadAndReview(subject, V2, v2Facts)
        expect(subject.model.critique).toHaveBeenCalledTimes(2)
        expect(third.review.state).toBe("done")
        expect(third.counts).toEqual(second.counts)
    })

    it("three failed tries: the critique is NOT done (reason model), shown honestly; the changed passage stays withheld from customers, the reviewed ones stay served", async () => {
        const subject = await build()
        subject.script.push(() => answered([]))
        await uploadAndReview(subject, V2, v1Facts)
        expect(subject.world.chunkWith(W.payment).customerReady).toBe(true)

        const view = await uploadAndReview(subject, V3, v1Facts)
        expect(subject.model.critique).toHaveBeenCalledTimes(4)
        expect(view.review).toEqual(expect.objectContaining({ state: "not_done", reason: "model", attempts: 3 }))
        expect(subject.world.chunkWith(W.cod).customerReady).toBe(false)
        expect(subject.world.chunkWith(fx.newRush).customerReady).toBe(true)

        // The founder lets customers read this version anyway: only the open high points still hold passages.
        await subject.read.release(WS, SRC, OWNER)
        expect(subject.world.chunkWith(W.cod).customerReady).toBe(true)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(false)
    })

    it("no credits: not done (reason credits) with no call; the first upload stays withheld from customers entirely, the rule points are already there", async () => {
        const subject = await build()
        subject.usage.blockedBy.mockResolvedValue(true)
        const view = await uploadAndReview(subject, V1, v1Facts)
        expect(subject.model.critique).not.toHaveBeenCalled()
        expect(view.review).toEqual(expect.objectContaining({ state: "not_done", reason: "credits" }))
        expect(view.serving).toEqual({ state: "withheld", withheldPassages: 8, totalPassages: 8 })
        expect(view.counts.open).toBe(6)
    })
})
