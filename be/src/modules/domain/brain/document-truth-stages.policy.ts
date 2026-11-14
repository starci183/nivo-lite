import type { FactFlag, FactInput } from "@modules/domain/brain-facts"
import type { PassageVerdict, TriageVerdict, TruthPassage } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { EXTRACTION_EFFORT, TRIAGE_EFFORT, type AiBudget } from "@modules/integrations/ai"
import { INHERITED_VERSION, type Inherited } from "./document-nature.policy"
import { MAX_TRUTHS_PER_CALL, numberedLinesOf, type ExtractedFact, type ReadPassage } from "./extraction.policy"
import { CODE_VERSION, THINKING_ROOM, codeVerdictOf, needsTriage, triageMaxTokensOf } from "./passage-triage.policy"
import { documentEvidenceOf, type Step, type WindowRead } from "./truth-window.policy"

/** The verdicts a triage gives with no passage call: by the code (too little text) and by the document's nature. */
export interface GivenVerdicts {
    /** Too little to state anything (`codeVerdictOf`). */
    readonly code: ReadonlyMap<string, TriageVerdict>
    /** Inherited from the document's nature or a table's (`inheritedOf`). */
    readonly inherited: ReadonlyMap<string, TriageVerdict>
}

/** The text of the lines named `n:Lk`, one a line, for the reading's notes (tenant data, never logged). */
export const unaccountedTextOf = (read: ReadonlyArray<ReadPassage>, names: ReadonlyArray<string>): string =>
    names
        .map((name) => {
            const [passage, line] = name.split(":L").map(Number)
            return `${name} ${numberedLinesOf(read[(passage ?? 0) - 1]?.text ?? "")[(line ?? 0) - 1] ?? ""}`
        })
        .join("\n")

/** Verdicts as the store takes them. */
export const listedOf = (verdicts: ReadonlyMap<string, TriageVerdict>): Array<PassageVerdict> =>
    [...verdicts.entries()].map(([id, verdict]) => ({ id, verdict }))

/** How many tries in a row may fail before the truths work of a document is given up (the owner's AI-error rule: three in total). */
export const MAX_ATTEMPTS = 3

/** How long the model may take for one call, once its turn at the model has come. */
export const CALL_TIMEOUT_MS = 180_000

/** What one triage call may spend: no reasoning, and room for the answer of its batch, sized from it (D-N-9). */
export const triageBudgetOf = (passages: number): AiBudget => ({ effort: TRIAGE_EFFORT, maxTokens: triageMaxTokensOf(passages) })

/** What one truth-reading call may spend: no reasoning, and at most forty compact lines (about 35 tokens each). */
export const TRUTHS_BUDGET: AiBudget = { effort: EXTRACTION_EFFORT, maxTokens: THINKING_ROOM + MAX_TRUTHS_PER_CALL * 40 + 400 }

/** What the call that reads the document's own date may spend: the reading's effort and room for its one short line. */
export const DATE_BUDGET: AiBudget = { effort: EXTRACTION_EFFORT, maxTokens: THINKING_ROOM + 200 }

/** The truths the store refused to file, one a line (`n|subject|attribute|value`), for the reading's notes (tenant data, never logged). */
export const filingFailedTextOf = (failed: ReadonlyArray<ExtractedFact>): string =>
    failed.map((fact) => [fact.subjectLabel, fact.attributeLabel, fact.value].join("|")).join("\n")

/** How many calls one process sends to the model at once (was 3; TRIAGE-4: at effort high a call reasons for seconds, and documents read together should not wait in one line of three): documents read together queue for a place. */
export const MODEL_PLACES = 16

/** The longest own answer a follow-up shows the model again, in characters. */
export const FOLLOW_UP_ANSWER_MAX = 16_000

/** What stands between two raw answers of one window in the reading's notes. */
export const ANSWERS_APART = "\n---\n"

/**
 * The verdicts given with no passage call that differ from what a passage holds: `code` (too little to state anything, rule material
 * only) and `inherited` (records, a log, reference, or a judged table within rule material).
 */
export const givenWithoutCall = (passages: ReadonlyArray<TruthPassage>, inherited: ReadonlyArray<Inherited>): GivenVerdicts => {
    const code = new Map<string, TriageVerdict>()
    const byNature = new Map<string, TriageVerdict>()
    passages.forEach((passage, index) => {
        const verdict = inherited[index] ?? "triage"
        if (verdict !== "triage") {
            if (passage.triage !== verdict || passage.triageVersion !== INHERITED_VERSION) byNature.set(passage.id, verdict)
            return
        }
        const short = codeVerdictOf(passage.text)
        if (short !== null && passage.triageVersion !== CODE_VERSION) code.set(passage.id, short)
    })
    return { code, inherited: byNature }
}

/** The passages with the verdicts a triage wrote; a passage whose verdict is no longer `rule` forgets its reading, as the store does. */
export const judgedPassages = (
    passages: ReadonlyArray<TruthPassage>,
    verdicts: ReadonlyMap<string, TriageVerdict>,
): ReadonlyArray<TruthPassage> => {
    return passages.map((passage) => {
        const verdict = verdicts.get(passage.id)
        if (verdict === undefined) return passage
        return { ...passage, triage: verdict, truthsVersion: verdict === "rule" ? passage.truthsVersion : null }
    })
}

/** The flag a truth carries when its stated period could not be read or computed (`FactFlag`). */
export const PERIOD_UNCLEAR: FactFlag = "period_unclear"

/**
 * The proposal a truth read from a document is filed as (never in force here: the settle decides). A truth whose stated period could
 * not be read or computed carries no period (the store's default validity) and the flag `period_unclear`: a note, never a question.
 */
export const proposalOf = (source: SourceRecord, fact: ExtractedFact): FactInput => ({
    subjectType: fact.subjectType,
    subjectLabel: fact.subjectLabel,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    // A truth takes the level the owner gave the document: public from a public document, and from an internal document the
    // audience of the truth it may replace (never wider than internal).
    scope: source.visibility === "public" ? "public" : undefined,
    sourceKind: "document",
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    autoApply: false,
    // A document kept for one agent instance proposes truths for that instance only.
    installationId: source.installationId,
    proposedBy: source.title.slice(0, 80),
    evidence: [documentEvidenceOf(source, fact)],
    ...(fact.periodUnclear === true ? { flags: [PERIOD_UNCLEAR] } : {}),
})

/** The passages the model has to triage: rule material that neither the code nor the nature judged, and that no current verdict covers. */
export const passagesForModel = (
    passages: ReadonlyArray<TruthPassage>,
    inherited: ReadonlyArray<Inherited>,
    given: GivenVerdicts,
): ReadonlyArray<TruthPassage> =>
    passages.filter(
        (passage, index) =>
            inherited[index] === "triage" &&
            !given.code.has(passage.id) &&
            (needsTriage(passage) || passage.triageVersion === INHERITED_VERSION),
    )

/** Where a triage stands after a batch was judged: the next batch, the model that answered, and the verdicts so far. */
export const afterTriage = (step: Step, counted: Step, model: Step["state"]["model"], judged: ReadonlyArray<PassageVerdict>): Step => ({
    ...counted,
    index: step.index + 1,
    state: { ...step.state, attempts: 0, model },
    verdicts: new Map([...step.verdicts, ...judged.map((one): [string, TriageVerdict] => [one.id, one.verdict])]),
})

/** Where a truth reading stands after a window was read: the next window, the calls it cost, what it filed and the passages it read. */
export const afterWindow = (step: Step, window: WindowRead, filed: number, ids: ReadonlyArray<string>): Step => ({
    ...step,
    index: step.index + 1,
    calls: step.calls + window.calls,
    state: {
        ...step.state,
        done: step.state.done + 1,
        filed: step.state.filed + filed,
        attempts: 0,
        model: window.answer?.model ?? step.state.model,
    },
    read: new Set([...step.read, ...ids]),
})
