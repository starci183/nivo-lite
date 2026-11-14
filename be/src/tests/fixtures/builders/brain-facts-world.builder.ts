import { builder, type MockOf } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS } from "@tests/fixtures/builders/document-facts.builder"
import type { BrainExtractionsService, MaybeExtraction } from "@modules/domain/brain-extractions"
import type { BrainFactsReadService, BrainFactsService, FactRecord } from "@modules/domain/brain-facts"
import { passageTextHashOf, type KnowledgeChunksService, type TruthPassage } from "@modules/domain/knowledge-chunks"
import type { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import type { KnowledgeSourcesService, SourceRecord } from "@modules/domain/knowledge-sources"
import type { TeamChatNoticesService } from "@modules/domain/team-chat"
import type { WorkspaceMember, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AiService } from "@modules/integrations/ai"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import type { PassageCritique, TruthCritiqueGate } from "@modules/domain/brain/direct-apply.policy"
import { tablesOf } from "@modules/domain/brain/document-nature.policy"
import type { DocumentNatureService } from "@modules/domain/brain/document-nature.service"
import type { FactEmbeddingsService } from "@modules/domain/brain/fact-embeddings.service"
import { TRIAGE_PROMPT } from "@modules/domain/brain/passage-triage.policy"
import type { DocumentFactsService, DocumentPartsService, TruthCeilingService } from "@modules/domain/brain"
import { CAU_CHUYEN_SO_VI, CHI_LAN_VI, LA_2_VI, LA_VI, MUC_PHI_2_VI, MUC_PHI_VI, PHI_DICH_VU_SO_0_VI, PHI_DICH_VU_SO_VI, SO_TAY_VI, TIEM_HOA_BAT_DAU_TU_MOT_VI, T_000D_CHO_MOI_DON_CUA_TIEM_VI, T_10_000D_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"

/** The tokens a scripted model call spends. */
export const FACTS_USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.001 }

/** A passage that states one rule: "<thing> is <n>.000 dong for every order." */
export const factsRuleText = (index: number): string =>
    `${PHI_DICH_VU_SO_VI}${String(index)}${LA_VI}${String(10 + index)}${T_000D_CHO_MOI_DON_CUA_TIEM_VI}`

/** A passage that states nothing of the shop. */
export const factsProseText = (index: number): string =>
    `${CAU_CHUYEN_SO_VI}${String(index)}${TIEM_HOA_BAT_DAU_TU_MOT_VI}`

/** A stored passage of the document, by default not yet judged and not yet read. */
export const factsPassageOf = (order: number, text: string, state: Partial<TruthPassage> = {}): TruthPassage => ({
    id: `c${String(order)}`,
    order,
    text,
    hash: passageTextHashOf(text),
    triage: null,
    triageVersion: null,
    truthsVersion: null,
    ...state,
})

/** `rules` rule passages followed by `prose` passages that state nothing. */
export const factsDocumentOf = (rules: number, prose: number): Array<TruthPassage> => [
    ...Array.from({ length: rules }, (_, index) => factsPassageOf(index, factsRuleText(index))),
    ...Array.from({ length: prose }, (_, index) => factsPassageOf(rules + index, factsProseText(index))),
]

/** A waiting truth filed from the document's passage, ready for overrides. */
export const factsProposalOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "f0",
    subjectType: "policy",
    subjectKey: "phi-dich-vu-so-0",
    subjectLabel: PHI_DICH_VU_SO_0_VI,
    attribute: "muc-phi",
    attributeLabel: MUC_PHI_VI,
    value: T_10_000D_VI,
    valueNumber: 10_000,
    unit: null,
    scope: "internal",
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
    proposedBy: SO_TAY_VI,
    proposedAt: "2026-11-11T03:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

/** The passage numbers a prompt carries. */
export const factsPassagesIn = (prompt: string): Array<string> => {
    const lines = prompt.split("\n")
    return lines.flatMap((line, index) => (/^PASSAGE \d+$/.test(line) ? [lines[index + 2] ?? ""] : []))
}

/** A finished critique that reviewed every given passage and holds nothing, with the given changes. */
export const factsReviewedAll = (passages: ReadonlyArray<TruthPassage>, more: Partial<PassageCritique> = {}): PassageCritique => ({
    state: "done",
    reviewed: new Set(passages.map((passage) => passage.hash)),
    held: new Set(),
    confirmedBy: new Map(),
    ...more,
})

/** What the scripted doubles read and write for one document. */
export interface FactsWorld {
    /** The stored passages of the document; the chunk store double reads and writes them. */
    passages: Array<TruthPassage>
    /** The row of the reading; the extraction store double reads and writes it. */
    row: MaybeExtraction
    /** The waiting truths of the document. */
    waiting: Array<FactRecord>
    /** The critic's verdict. */
    critique: PassageCritique
}

/** The doubles of the collaborators of a document's reading, as a facts spec builds them. */
export interface FactsDoubles {
    readonly ai: MockOf<AiService>
    readonly facts: MockOf<BrainFactsService>
    readonly reads: MockOf<BrainFactsReadService>
    readonly extractions: MockOf<BrainExtractionsService>
    readonly indexing: MockOf<KnowledgeIndexingService>
    readonly sources: MockOf<KnowledgeSourcesService>
    readonly chunks: MockOf<KnowledgeChunksService>
    readonly usage: MockOf<UsageMeterService>
    readonly vectors: MockOf<FactEmbeddingsService>
    readonly nature: MockOf<DocumentNatureService>
    readonly members: MockOf<WorkspaceMembersService>
    readonly ceiling: MockOf<TruthCeilingService>
    readonly notices: MockOf<TeamChatNoticesService>
    readonly critic: MockOf<TruthCritiqueGate>
    readonly parts: MockOf<DocumentPartsService>
    readonly queue: MockOf<KnowledgeQueue>
}

/** A membership row of the workspace: by default the founder's. */
const founderMemberOf = builder<WorkspaceMember>({
    userId: "founder",
    workspaceId: DOC_WS,
    role: "owner",
    staffId: null,
    displayName: CHI_LAN_VI,
    status: "active",
})

/** The scripted model: every answer is a try that answered; triage calls a passage a rule when its text states a fee. */
const scriptModel = (ai: MockOf<AiService>): void => {
    // The stages call `attempt`; the scripted answers stay on `chat`: an answer is a try that answered, none a provider failure.
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "provider" } : { ok: true, answer }
    })
    // The scripted model: triage calls a passage a rule when its text states a fee; the reading gives one line per rule passage.
    ai.chat.mockImplementation((request) => {
        const [system, user] = request.messages
        const texts = factsPassagesIn(user?.content ?? "")
        if (system?.content === TRIAGE_PROMPT) {
            const rule = texts.flatMap((text, index) => (text.includes(LA_2_VI) && /\d/.test(text) ? [index + 1] : []))
            return Promise.resolve({
                text: JSON.stringify({ rule, data: [] }),
                model: "haiku",
                usage: FACTS_USAGE,
                parsed: null,
                retrieved: 0,
            })
        }
        const lines = texts.map((text, index) => {
            // The reading numbers the lines of a passage (L1 ...): the scripted model reads past the number.
            const found = new RegExp(String.raw`^(?:L\d+ )?(.+?)${LA_VI}(\S+)`).exec(text)
            return `${String(index + 1)}|policy|${found?.[1] ?? "?"}${MUC_PHI_2_VI}${found?.[2] ?? "?"}|-|-|-`
        })
        return Promise.resolve({ text: lines.join("\n"), model: "haiku", usage: FACTS_USAGE, parsed: null, retrieved: 0 })
    })

}

/** The facts store and its readers: filing a truth stores a waiting proposal that names the passage it was read from. */
const scriptFacts = (facts: MockOf<BrainFactsService>, reads: MockOf<BrainFactsReadService>, world: FactsWorld): void => {
    facts.byKey.mockResolvedValue([])
    facts.get.mockResolvedValue(null)
    facts.withdrawChanged.mockResolvedValue({ orphans: [], withdrawn: 0 })
    facts.applyUnannounced.mockImplementation((_ws, id) => {
        world.waiting = world.waiting.filter((fact) => fact.id !== id)
        return Promise.resolve(factsProposalOf({ id, status: "active" }))
    })
    // Filing a truth stores a waiting proposal that names the passage it was read from.
    facts.propose.mockImplementation((_ws, input) => {
        const fact = factsProposalOf({
            id: `f-${input.subjectLabel}-${input.value}`,
            subjectLabel: input.subjectLabel,
            subjectKey: input.subjectLabel,
            value: input.value,
            evidence: [...(input.evidence ?? [])],
        })
        world.waiting.push(fact)
        return Promise.resolve({ fact, outcome: "proposed", created: true })
    })
    reads.ofSources.mockImplementation(() => Promise.resolve([...world.waiting]))
    reads.kinOf.mockResolvedValue([])
    reads.byIds.mockResolvedValue([])

}

/** The chunk store: it reads and writes the passages of the world. */
const scriptChunks = (chunks: MockOf<KnowledgeChunksService>, world: FactsWorld): void => {
    chunks.truthPassagesOf.mockImplementation(() => Promise.resolve(world.passages.map((passage) => ({ ...passage }))))
    chunks.setTriage.mockImplementation((_ws, verdicts, version) => {
        const byId = new Map(verdicts.map((one) => [one.id, one.verdict]))
        world.passages = world.passages.map((passage) => {
            const verdict = byId.get(passage.id)
            return verdict === undefined
                ? passage
                : {
                      ...passage,
                      triage: verdict,
                      triageVersion: version,
                      truthsVersion: verdict === "rule" ? passage.truthsVersion : null,
                  }
        })
        return Promise.resolve()
    })
    chunks.markTruthsRead.mockImplementation((_ws, ids, version) => {
        world.passages = world.passages.map((passage) =>
            ids.includes(passage.id) ? { ...passage, truthsVersion: version } : passage,
        )
        return Promise.resolve()
    })

}

/** The extraction store: it reads and writes the row of the reading. */
const scriptExtractions = (extractions: MockOf<BrainExtractionsService>, world: FactsWorld): void => {
    extractions.get.mockImplementation(() => Promise.resolve(world.row))
    extractions.start.mockImplementation((start) => {
        world.row = {
            sourceId: DOC_SOURCE,
            status: "running",
            factsProposed: 0,
            promptVersion: start.promptVersion,
            contentHash: start.contentHash,
            windowsTotal: 0,
            windowsDone: 0,
            attempts: 0,
            orphanFactIds: start.orphanFactIds,
            passageHashes: world.row?.passageHashes ?? [],
            factsChanged: start.factsChanged,
            stage: "triage",
            counts: {
                passagesTotal: start.passagesTotal,
                passagesTriaged: 0,
                passagesKept: 0,
                factsApplied: 0,
                factsAsked: 0,
                factsWaiting: 0,
            },
            windowsSkipped: 0,
            linesRefused: 0,
            updatedAt: new Date("2026-11-11T03:00:00.000Z"),
        }
        return Promise.resolve()
    })
    extractions.save.mockImplementation((_ws, _source, progress) => {
        if (world.row === null) return Promise.resolve()
        world.row = {
            ...world.row,
            status: progress.status,
            windowsDone: progress.windowsDone,
            windowsTotal: progress.windowsTotal,
            factsProposed: progress.factsProposed,
            attempts: progress.attempts,
            stage: progress.stage ?? world.row.stage,
            counts: { ...world.row.counts, ...progress.counts },
        }
        return Promise.resolve()
    })
    extractions.finish.mockImplementation((_ws, _source, _model, hashes) => {
        if (world.row !== null) world.row = { ...world.row, status: "done", passageHashes: hashes, orphanFactIds: [] }
        return Promise.resolve()
    })
    extractions.resume.mockImplementation(() => {
        if (world.row !== null) world.row = { ...world.row, status: "running" }
        return Promise.resolve(true)
    })
    extractions.reopen.mockImplementation(() => {
        if (world.row?.stage !== "settle") return Promise.resolve(false)
        world.row = { ...world.row, status: "running" }
        return Promise.resolve(true)
    })

}

/** The collaborators around the stages: the map, the parts, the credit pool, the ceiling, the critic and the founder's membership. */
const scriptMisc = (d: FactsDoubles, world: FactsWorld, source: SourceRecord): void => {
    const { vectors, nature, parts, indexing, sources, usage, queue, ceiling, notices, critic, members } = d
    vectors.recheckBeforeForce.mockResolvedValue("clear")
    // The document's map (one model call, scripted): the business's rules, every table in it a table of records.
    nature.natureFor.mockImplementation((_source, passages) =>
        Promise.resolve({
            kind: "ready",
            calls: 1,
            nature: {
                nature: "rules",
                sections: [],
                tables: Object.fromEntries(tablesOf(passages.map((passage) => passage.text)).map((table) => [table.key, "records" as const])),
                by: "model",
            },
        }),
    )
    parts.wholeOf.mockResolvedValue([DOC_SOURCE])
    indexing.sourceForFacts.mockResolvedValue(source)
    sources.sourceOf.mockResolvedValue(source)
    usage.blockedBy.mockResolvedValue(false)
    queue.enqueueFactsNext.mockResolvedValue(undefined)
    vectors.checkSameMeaning.mockResolvedValue({ judged: 0, flagged: 0 })
    ceiling.room.mockResolvedValue({ truths: 5_000, bytes: 2_000_000 })
    notices.postBackgroundStopped.mockResolvedValue("posted")
    critic.truthGateOf.mockImplementation(() => Promise.resolve(world.critique))
    // The founder, a manager and a staff member are active members; anyone else (a person who left, an API key) is refused.
    members.require.mockImplementation((userId) => {
        if (userId === "founder") return Promise.resolve(founderMemberOf())
        if (userId === "manager") return Promise.resolve(founderMemberOf({ userId, role: "manager", displayName: "Minh Manager" }))
        if (userId === "staff") return Promise.resolve(founderMemberOf({ userId, role: "staff", staffId: "st1", displayName: "Sau Staff" }))
        return Promise.reject(new Error("not a member"))
    })
}

/** Scripts the doubles of a facts spec: the model, the stores and the collaborators, all reading and writing the one world. */
export const scriptFactsWorld = (d: FactsDoubles, world: FactsWorld, source: SourceRecord): void => {
    scriptModel(d.ai)
    scriptMisc(d, world, source)
    scriptFacts(d.facts, d.reads, world)
    scriptChunks(d.chunks, world)
    scriptExtractions(d.extractions, world)
}

/** The job runners a facts spec calls on the service: run until the reading stops handing over; change the critic's word, then settle again. */
export const factsRunnersOf = (service: DocumentFactsService, ai: MockOf<AiService>, world: FactsWorld) => {
    const payload = { workspaceId: DOC_WS, sourceId: DOC_SOURCE }
    return {
        callsTo: (system: string): number => ai.chat.mock.calls.filter(([request]) => request.messages[0]?.content === system).length,
        runAll: async (): Promise<string> => {
            let outcome = await service.run(payload)
            while (outcome === "continued") outcome = await service.run(payload)
            return outcome
        },
        critiqueThenSettle: async (more: Partial<PassageCritique> = {}): Promise<string> => {
            world.critique = factsReviewedAll(world.passages, more)
            await service.critiqued(DOC_WS, DOC_SOURCE)
            return service.run(payload)
        },
    }
}
