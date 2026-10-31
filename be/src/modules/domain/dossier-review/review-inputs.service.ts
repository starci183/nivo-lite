import { Injectable } from "@nestjs/common"
import { BrainDossiersReadService } from "@modules/domain/brain-dossiers"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord, FactStatus } from "@modules/domain/brain-facts"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { SourcePassage } from "@modules/domain/knowledge-chunks"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import type { DossierSource } from "@modules/domain/knowledge-sources"
import { eachInOrder } from "@modules/platform/primitives"
import { dateOfSource, refOfSource, stateOfSource } from "./document-state.policy"
import { packEntryOf } from "./dossier-pack.policy"
import { SIGNING_ATTRIBUTES } from "./pack-vocabulary.policy"
import type { DocumentInput, DossierInputs, PackEntry, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import type { OptionalId } from "./dossier-review.contracts"
import { dateOfFact, isAttribute } from "./rule-kit.policy"

/** The fact statuses the rules read: document facts are proposals until the owner applies them. */
const READ_STATUSES: ReadonlyArray<FactStatus> = ["active", "proposed", "scheduled"]

/** The bounds of one collection. */
const BOUNDS = { sources: 2_000, facts: 2_000, activeFacts: 500, perSource: 40, batch: 100 } as const

/** What a run reads: the pass of dossiers the rules evaluate and the dossiers the model reads in full. */
export interface CollectedInputs {
    /** The dossiers of the pass with their documents and facts. */
    readonly context: ReviewContext
    /** The ids of the dossiers the model pass reads. */
    readonly targetIds: ReadonlyArray<string>
}

/** A fact as the rules read it. */
export const toReviewFact = (fact: FactRecord): ReviewFact => ({
    id: fact.id,
    subjectKey: fact.subjectKey,
    subject: fact.subjectLabel,
    attribute: fact.attribute,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    valueNumber: fact.valueNumber,
    unit: fact.unit,
    status: fact.status,
    validFrom: fact.validFrom === null ? null : fact.validFrom.slice(0, 10),
    validTo: fact.validTo === null ? null : fact.validTo.slice(0, 10),
    conflictWith: fact.conflictWith,
    sourceIds: [
        ...new Set(fact.evidence.flatMap((item) => (item.kind === "document" ? [item.sourceId ?? item.ref] : []))),
    ],
    quotes: fact.evidence.flatMap((item) => (item.quote === undefined ? [] : [item.quote])),
    updatedAt: fact.decidedAt ?? fact.proposedAt,
})

const batchesOf = <Item>(items: ReadonlyArray<Item>, size: number): ReadonlyArray<ReadonlyArray<Item>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

const keyOf = (category: string, ref: string): string => `${category.normalize("NFC")}\u0000${ref}`

/** The dossiers the pack relates to a dossier, by id, the dossier itself first. */
const relatedIds = (
    target: DossierEntry,
    entry: PackEntry | null,
    all: ReadonlyArray<DossierEntry>,
): ReadonlyArray<string> => [
    target.id,
    ...all.filter((dossier) => (entry?.related ?? []).includes(dossier.ref)).map((dossier) => dossier.id),
]

/** Which dossier each document files under: its topic is the dossier's category and its reference the dossier's. */
class SourceOwners {
    private readonly byKey: ReadonlyMap<string, DossierEntry>
    private readonly byId: ReadonlyMap<string, DossierSource>

    constructor(
        dossiers: ReadonlyArray<DossierEntry>,
        private readonly sources: ReadonlyArray<DossierSource>,
    ) {
        this.byKey = new Map(dossiers.map((dossier) => [keyOf(dossier.category, dossier.ref), dossier]))
        this.byId = new Map(sources.map((source) => [source.id, source]))
    }

    /** The dossier a document files under. */
    ownerOf(source: DossierSource): DossierEntry | undefined {
        const ref = refOfSource(source)
        return source.topic === null || ref === null ? undefined : this.byKey.get(keyOf(source.topic, ref))
    }

    /** The documents of these dossiers. */
    sourcesOf(ids: ReadonlySet<string>): ReadonlyArray<DossierSource> {
        return this.sources.filter((source) => {
            const owner = this.ownerOf(source)
            return owner !== undefined && ids.has(owner.id)
        })
    }

    /** The dossiers these documents file under. */
    dossiersCited(sourceIds: ReadonlyArray<string>): ReadonlyArray<string> {
        return sourceIds.flatMap((id) => {
            const source = this.byId.get(id)
            const owner = source === undefined ? undefined : this.ownerOf(source)
            return owner === undefined ? [] : [owner.id]
        })
    }
}

@Injectable()
/** Collects what a review run reads about the dossiers of a workspace, through the read services of their owners, one bounded read at a time. */
export class ReviewInputsService {
    constructor(
        private readonly dossiers: BrainDossiersReadService,
        private readonly sources: DossierSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly facts: BrainFactsReadService,
    ) {}

    /** The dossiers of the workspace. */
    all(workspaceId: string): Promise<ReadonlyArray<DossierEntry>> {
        return this.dossiers.all(workspaceId)
    }

    /**
     * The pass of a run: every dossier for a workspace run; for a dossier run the dossier, the dossiers the pack relates to it and those
     * whose documents its facts also cite. The model reads the dossier of a dossier run, or every dossier of a workspace run.
     */
    async collect(workspaceId: string, dossierId: OptionalId, today: string): Promise<CollectedInputs> {
        const all = await this.dossiers.all(workspaceId)
        const sources = await this.sources.sourcesOfTopics(
            workspaceId,
            [...new Set(all.map((dossier) => dossier.category))],
            BOUNDS.sources,
        )
        const owners = new SourceOwners(all, sources)
        const target = all.find((dossier) => dossier.id === dossierId)
        const pass = new Set(dossierId === null ? all.map((dossier) => dossier.id) : [])
        if (target !== undefined) for (const id of relatedIds(target, packEntryOf(target), all)) pass.add(id)
        const facts = await this.factsOf(workspaceId, owners.sourcesOf(pass))
        if (target !== undefined) await this.widen(workspaceId, owners, pass, facts)
        const passSources = owners.sourcesOf(pass)
        const passages = await this.passagesOf(workspaceId, passSources)
        const active = await this.facts.list(workspaceId, { statuses: ["active"], limit: BOUNDS.activeFacts })
        const dossiers = all
            .filter((dossier) => pass.has(dossier.id))
            .map((dossier) =>
                this.inputsOf(dossier, packEntryOf(dossier), owners.sourcesOf(new Set([dossier.id])), passages, facts),
            )
        const targetIds = all
            .filter((dossier) => dossierId === null || dossier.id === dossierId)
            .map((dossier) => dossier.id)
        return { context: { today, dossiers, activeFacts: active.map(toReviewFact) }, targetIds }
    }

    /** Adds to a dossier pass the dossiers whose documents its facts also cite, with their own facts. */
    private async widen(
        workspaceId: string,
        owners: SourceOwners,
        pass: Set<string>,
        facts: Array<ReviewFact>,
    ): Promise<void> {
        const added = new Set(
            facts.flatMap((fact) => owners.dossiersCited(fact.sourceIds)).filter((id) => !pass.has(id)),
        )
        for (const id of added) pass.add(id)
        const known = new Set(facts.map((fact) => fact.id))
        for (const fact of await this.factsOf(workspaceId, owners.sourcesOf(added))) {
            if (!known.has(fact.id)) facts.push(fact)
        }
    }

    private async factsOf(workspaceId: string, sources: ReadonlyArray<DossierSource>): Promise<Array<ReviewFact>> {
        const facts = new Map<string, ReviewFact>()
        await eachInOrder(batchesOf(sources, BOUNDS.batch), async (batch) => {
            const read = await this.facts.ofSources(
                workspaceId,
                batch.map((source) => source.id),
                READ_STATUSES,
                BOUNDS.facts,
            )
            for (const fact of read) if (!facts.has(fact.id)) facts.set(fact.id, toReviewFact(fact))
        })
        return [...facts.values()]
    }

    private async passagesOf(
        workspaceId: string,
        sources: ReadonlyArray<DossierSource>,
    ): Promise<ReadonlyArray<SourcePassage>> {
        const passages: Array<SourcePassage> = []
        await eachInOrder(batchesOf(sources, BOUNDS.batch), async (batch) => {
            passages.push(
                ...(await this.chunks.passagesOfSources(
                    workspaceId,
                    batch.map((source) => source.id),
                    BOUNDS.perSource,
                )),
            )
        })
        return passages
    }

    private inputsOf(
        dossier: DossierEntry,
        entry: PackEntry | null,
        sources: ReadonlyArray<DossierSource>,
        passages: ReadonlyArray<SourcePassage>,
        facts: ReadonlyArray<ReviewFact>,
    ): DossierInputs {
        const ids = new Set(sources.map((source) => source.id))
        const own = facts.filter((fact) => fact.sourceIds.some((id) => ids.has(id)))
        const documents = sources.map((source): DocumentInput => {
            const signed = own
                .filter((fact) => fact.sourceIds.includes(source.id) && isAttribute(fact, SIGNING_ATTRIBUTES))
                .flatMap((fact) => {
                    const date = dateOfFact(fact)
                    return date === null ? [] : [date]
                })
            return {
                id: source.id,
                title: source.title,
                tags: source.tags,
                origin: source.origin,
                state: stateOfSource(source, entry?.requirement === "template" ? dossier.name : null),
                date: dateOfSource(source.title, signed),
                updatedAt: source.updatedAt,
                chunkCount: source.chunkCount,
                passages: passages
                    .filter((passage) => passage.sourceId === source.id)
                    .map((passage) => ({ id: passage.id, order: passage.order, text: passage.text })),
            }
        })
        return {
            dossier: {
                id: dossier.id,
                ref: dossier.ref,
                name: dossier.name,
                category: dossier.category,
                position: dossier.position,
                checklistStatus: dossier.status,
                existing: dossier.existing,
                missing: dossier.missing,
                drafts: dossier.drafts,
            },
            entry,
            documents,
            facts: own,
        }
    }
}
