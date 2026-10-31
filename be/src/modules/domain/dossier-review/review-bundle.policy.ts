import { createHash } from "node:crypto"
import {
    DOSSIER_REVIEW_CAPS,
    DOSSIER_REVIEW_PACK_VERSION,
    DOSSIER_REVIEW_PROMPT_VERSION,
    isRemedyAction,
} from "./dossier-review.contracts"
import type { EvidenceRole, FindingEvidence } from "./dossier-review.contracts"
import type {
    DocumentInput,
    DocumentState,
    DossierInputs,
    FindingCandidate,
    ReviewFact,
} from "./dossier-inputs.contracts"
import type { BundleDocument, BundleItem, CitedQuote, DossierBundle, ReasonedReview } from "./dossier-review.port"
import { itemHolds, normalizeQuote } from "./evidence.policy"
import type { EvidenceCorpus } from "./evidence.policy"

/** A passage key and what it stands for. */
export interface PassageKey {
    /** The passage id. */
    readonly passageId: string
    /** The source it belongs to. */
    readonly sourceId: string
}

/** A fact to show, with the reference of the related dossier it comes from. */
interface ShownFact {
    /** The fact. */
    readonly fact: ReviewFact
    /** The related dossier's reference, or null for a fact of the dossier itself. */
    readonly ref: string | null
}

/** What each key of a bundle stands for. */
export interface BundleKeys {
    /** Document keys (S1) to source ids. */
    readonly sources: ReadonlyMap<string, string>
    /** Passage keys (S1.P1) to passage and source ids. */
    readonly passages: ReadonlyMap<string, PassageKey>
    /** Fact keys (F1) to fact ids. */
    readonly facts: ReadonlyMap<string, string>
    /** Open model finding keys (A1) to fingerprints. */
    readonly openAi: ReadonlyMap<string, string>
}

/** A finding already known for the dossier, shown to the model so it does not repeat it. */
export interface KnownItem {
    /** The kind. */
    readonly kind: string
    /** The title. */
    readonly title: string
}

/** An open model finding the model re-judges. */
export interface OpenAiItem {
    /** Its fingerprint. */
    readonly fingerprint: string
    /** The title. */
    readonly title: string
    /** The detail. */
    readonly detail: string
}

/** What a bundle is built from. */
export interface BundleInput {
    /** The workspace. */
    readonly workspaceId: string
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** The dossier under review. */
    readonly inputs: DossierInputs
    /** The related dossiers of the pass. */
    readonly related: ReadonlyArray<DossierInputs>
    /** The findings already known. */
    readonly known: ReadonlyArray<KnownItem>
    /** The open model findings. */
    readonly openAi: ReadonlyArray<OpenAiItem>
}

/** A bundle with its keys and its size in characters. */
export interface BuiltBundle {
    /** The bundle the model reads. */
    readonly bundle: DossierBundle
    /** What its keys stand for. */
    readonly keys: BundleKeys
    /** How many characters of text it carries. */
    readonly chars: number
}

const byText = (a: string, b: string): number => a.localeCompare(b)

const clip = (text: string, max: number): string => (text.length <= max ? text : text.slice(0, max))

/** A fact as one line of the bundle. */
export const factText = (fact: ReviewFact, sourceKey: string | null): string => {
    const unit = fact.unit === null ? "" : ` ${fact.unit}`
    const from = fact.validFrom === null ? "" : `, from ${fact.validFrom}`
    const cited = sourceKey === null ? "" : ` - ${sourceKey}`
    return `${fact.subject} | ${fact.attributeLabel} = ${fact.value}${unit} (${fact.status}${from})${cited}`
}

const checklistOf = (inputs: DossierInputs): BundleItem | null => {
    const parts = [
        inputs.dossier.existing === null ? null : `held: ${inputs.dossier.existing}`,
        inputs.dossier.missing === null ? null : `missing: ${inputs.dossier.missing}`,
        inputs.dossier.drafts === null ? null : `drafts: ${inputs.dossier.drafts}`,
    ].filter((part) => part !== null)
    return parts.length === 0 ? null : { key: "C1", text: clip(parts.join("; "), DOSSIER_REVIEW_CAPS.passageChars) }
}

/** What a bundle under construction holds: its characters spent and the keys handed out, first come first served. */
interface BundleState {
    /** The characters spent. */
    used: number
    /** Document keys to source ids. */
    readonly sources: Map<string, string>
    /** Source ids to document keys. */
    readonly keyOfSource: Map<string, string>
    /** Passage keys to what they stand for. */
    readonly passages: Map<string, PassageKey>
    /** Fact keys to fact ids. */
    readonly facts: Map<string, string>
    /** The facts shown already. */
    readonly factIds: Set<string>
    /** The fact lines. */
    readonly factItems: Array<BundleItem>
}

/** Takes a text when it fits in the 24,000 characters of a bundle. */
const fits = (state: BundleState, text: string): boolean => {
    if (state.used + text.length > DOSSIER_REVIEW_CAPS.bundleChars) return false
    state.used += text.length
    return true
}

const STATE_RANK: Readonly<Record<DocumentState, number>> = { actual: 0, draft: 1, template: 2 }

const byStateThenDate = (a: DocumentInput, b: DocumentInput): number =>
    STATE_RANK[a.state] - STATE_RANK[b.state] || (b.date ?? "").localeCompare(a.date ?? "")

/** One document with as many of its passages as its share and the budget allow. */
const documentOf = (state: BundleState, doc: DocumentInput, key: string): BundleDocument => {
    const caps = DOSSIER_REVIEW_CAPS
    state.sources.set(key, doc.id)
    state.keyOfSource.set(doc.id, key)
    fits(state, doc.title)
    let spent = 0
    const items: Array<BundleItem> = []
    for (const passage of doc.passages) {
        const text = clip(passage.text, Math.min(caps.passageChars, caps.documentChars - spent))
        if (text.length === 0 || !fits(state, text)) break
        spent += text.length
        const passageKey = `${key}.P${items.length + 1}`
        state.passages.set(passageKey, { passageId: passage.id, sourceId: doc.id })
        items.push({ key: passageKey, text })
    }
    return { key, title: doc.title, state: doc.state, date: doc.date, passages: items }
}

/** Up to `max` facts not shown yet, each with the key of the first of its documents in the bundle; a related dossier's facts carry its reference. */
const addFacts = (state: BundleState, list: ReadonlyArray<ShownFact>, max: number): void => {
    let added = 0
    for (const { fact, ref } of list) {
        if (added >= max) return
        if (state.factIds.has(fact.id)) continue
        const sourceKey = fact.sourceIds.map((id) => state.keyOfSource.get(id)).find((key) => key !== undefined)
        const marker = ref === null ? "" : `[${ref}] `
        const text = marker + factText(fact, sourceKey ?? null)
        if (!fits(state, text)) return
        const key = `F${state.factItems.length + 1}`
        state.facts.set(key, fact.id)
        state.factIds.add(fact.id)
        state.factItems.push({ key, text })
        added += 1
    }
}

/**
 * The bundle of one dossier within the caps: the checklist row, at most 12 documents (actual first, newest first) with at most 3,000
 * characters each in passages of at most 1,200, at most 120 facts of the dossier and 60 of the related dossiers, the known findings and
 * the open model findings, 24,000 characters in all. Keys are the only way the model can cite.
 */
export const buildBundle = (input: BundleInput): BuiltBundle => {
    const caps = DOSSIER_REVIEW_CAPS
    const state: BundleState = {
        used: 0,
        sources: new Map(),
        keyOfSource: new Map(),
        passages: new Map(),
        facts: new Map(),
        factIds: new Set(),
        factItems: [],
    }
    const checklist = checklistOf(input.inputs)
    if (checklist !== null) fits(state, checklist.text)
    const documents = [...input.inputs.documents]
        .sort(byStateThenDate)
        .slice(0, caps.documents)
        .map((doc, index) => documentOf(state, doc, `S${index + 1}`))
    addFacts(
        state,
        input.inputs.facts.map((fact) => ({ fact, ref: null })),
        caps.dossierFacts,
    )
    addFacts(
        state,
        input.related.flatMap((other) => other.facts.map((fact) => ({ fact, ref: other.dossier.ref }))),
        caps.relatedFacts,
    )
    const known = input.known
        .slice(0, caps.knownMax)
        .map((item, index) => ({ key: `K${index + 1}`, text: `${item.kind} ${item.title}` }))
        .filter((item) => fits(state, item.text))
    const openAiKeys = new Map<string, string>()
    const openAi = input.openAi.slice(0, caps.openAiMax).flatMap((item, index) => {
        const text = `${item.title} - ${item.detail}`
        if (!fits(state, text)) return []
        openAiKeys.set(`A${index + 1}`, item.fingerprint)
        return [{ key: `A${index + 1}`, text }]
    })
    return {
        bundle: {
            workspaceId: input.workspaceId,
            today: input.today,
            packVersion: DOSSIER_REVIEW_PACK_VERSION,
            dossier: {
                ref: input.inputs.dossier.ref,
                name: input.inputs.dossier.name,
                category: input.inputs.dossier.category,
                requirement: input.inputs.entry?.requirement ?? "unknown",
                basis: input.inputs.entry?.basis ?? [],
            },
            checklist,
            related: input.related.map((other) => ({ ref: other.dossier.ref, name: other.dossier.name })),
            documents,
            facts: state.factItems,
            known,
            openAi,
        },
        keys: { sources: state.sources, passages: state.passages, facts: state.facts, openAi: openAiKeys },
        chars: state.used,
    }
}

/** What the evidence of a pass can be checked against: the titles, passages and facts of its dossiers. */
export const corpusOf = (dossiers: ReadonlyArray<DossierInputs>): EvidenceCorpus => ({
    sources: new Map(dossiers.flatMap((inputs) => inputs.documents.map((doc) => [doc.id, doc.title] as const))),
    passages: new Map(
        dossiers.flatMap((inputs) =>
            inputs.documents.flatMap((doc) => doc.passages.map((passage) => [passage.id, passage.text] as const)),
        ),
    ),
    facts: new Map(
        dossiers.flatMap((inputs) =>
            inputs.facts.map((fact) => [fact.id, { value: fact.value, quotes: fact.quotes }] as const),
        ),
    ),
})

/** An item no corpus holds: a citation of a key the bundle never gave, dropped by the guard. */
const UNKNOWN_KEY = "unknown"

/** A cited key and quote as an evidence item of the corpus; a document key is resolved to the passage of it the quote comes from. */
export const citedEvidence = (
    cited: CitedQuote,
    role: EvidenceRole,
    keys: BundleKeys,
    corpus: EvidenceCorpus,
): FindingEvidence => {
    const item = (fields: Partial<FindingEvidence>): FindingEvidence => ({
        role,
        label: cited.key,
        sourceId: null,
        sourceTitle: null,
        passageId: null,
        factId: null,
        factLine: null,
        quote: cited.quote,
        ...fields,
    })
    const titled = (sourceId: string): Partial<FindingEvidence> => ({
        sourceId,
        sourceTitle: corpus.sources.get(sourceId) ?? null,
    })
    const passage = keys.passages.get(cited.key)
    if (passage !== undefined) return item({ ...titled(passage.sourceId), passageId: passage.passageId })
    const factId = keys.facts.get(cited.key)
    if (factId !== undefined) return item({ factId })
    const sourceId = keys.sources.get(cited.key)
    if (sourceId !== undefined) {
        const wanted = normalizeQuote(cited.quote)
        const found = [...keys.passages.values()].find(
            (entry) =>
                entry.sourceId === sourceId &&
                normalizeQuote(corpus.passages.get(entry.passageId) ?? "").includes(wanted),
        )
        return item({ ...titled(sourceId), passageId: found?.passageId ?? UNKNOWN_KEY })
    }
    if (cited.key === "C1") return item({ role: "context", quote: null })
    return item({ passageId: UNKNOWN_KEY })
}

/** The part a cited item plays: the first is the claim, the others counter a contradiction or give context. */
const roleOf = (index: number, kind: string): EvidenceRole => {
    if (index === 0) return "claim"
    return kind === "contradiction" ? "counter" : "context"
}

/** The model's findings as candidates of the dossier: evidence resolved through the keys, related dossiers kept only among the related ones, text within the column bounds. */
export const reasonedCandidates = (
    review: ReasonedReview,
    built: BuiltBundle,
    inputs: DossierInputs,
    related: ReadonlyArray<DossierInputs>,
    corpus: EvidenceCorpus,
): ReadonlyArray<FindingCandidate> => {
    const relatedIds = new Map(related.map((other) => [other.dossier.ref, other.dossier.id]))
    return review.findings.map((finding) => ({
        ruleKey: "ai",
        dossierId: inputs.dossier.id,
        relatedDossierIds: [
            ...new Set(
                finding.relatedRefs.flatMap((ref) => {
                    const id = relatedIds.get(ref)
                    return id === undefined ? [] : [id]
                }),
            ),
        ].sort((a, b) => a.localeCompare(b)),
        kind: finding.kind,
        severity: finding.severity,
        origin: "ai",
        code: null,
        params: {},
        title: clip(finding.title, DOSSIER_REVIEW_CAPS.titleMax),
        detail: clip(finding.detail, DOSSIER_REVIEW_CAPS.detailMax),
        evidence: finding.evidence.map((cited, index) =>
            citedEvidence(cited, roleOf(index, finding.kind), built.keys, corpus),
        ),
        remedyAction: isRemedyAction(finding.remedyAction) ? finding.remedyAction : "decide",
        remedyDocumentType: finding.documentType === null ? null : clip(finding.documentType, 80),
        subject: "",
    }))
}

/**
 * The open model findings the model resolved: it said the finding no longer applies and cited evidence that verifies and comes from a
 * document changed after the finding was first seen. Anything less leaves the finding as it is.
 */
export const resolvedByModel = (
    review: ReasonedReview,
    built: BuiltBundle,
    corpus: EvidenceCorpus,
    changedAt: ReadonlyMap<string, string>,
    firstSeenAt: ReadonlyMap<string, string>,
): ReadonlySet<string> =>
    new Set(
        review.stillOpen.flatMap((verdict) => {
            const fingerprint = built.keys.openAi.get(verdict.key)
            if (verdict.applies || fingerprint === undefined) return []
            const since = firstSeenAt.get(fingerprint) ?? ""
            const resolving = verdict.evidence
                .map((cited) => citedEvidence(cited, "context", built.keys, corpus))
                .some(
                    (item) =>
                        item.sourceId !== null &&
                        itemHolds(item, corpus) &&
                        (changedAt.get(item.sourceId) ?? "") > since,
                )
            return resolving ? [fingerprint] : []
        }),
    )

/** What the model pass of a dossier reads, as one hash: the prompt and pack versions, its documents, its facts and its open rule findings. Unchanged, no model call. */
export const inputsFingerprintOf = (inputs: DossierInputs, openRuleFingerprints: ReadonlyArray<string>): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                DOSSIER_REVIEW_PROMPT_VERSION,
                DOSSIER_REVIEW_PACK_VERSION,
                inputs.documents.map((doc) => `${doc.id}|${doc.updatedAt}|${doc.chunkCount}`).sort(byText),
                inputs.facts.map((fact) => `${fact.id}|${fact.status}|${fact.value}`).sort(byText),
                [...openRuleFingerprints].sort(byText),
            ]),
        )
        .digest("hex")
        .slice(0, 32)
