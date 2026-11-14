import type { DocumentNatureView, DocumentTruthsView, MaybeDocumentTruths } from "@modules/domain/brain-extractions"

/** The truths state of a part whose truths work has not started: nothing judged, nothing found. */
const NOT_STARTED: DocumentTruthsView = {
    state: "running",
    stage: "triage",
    note: null,
    passagesTotal: 0,
    passagesTriaged: 0,
    passagesKept: 0,
    callsDone: 0,
    callsTotal: 0,
    truthsFound: 0,
    truthsInForce: 0,
    truthsAsked: 0,
    truthsWaiting: 0,
    callsSkipped: 0,
    linesRefused: 0,
}

/** How far the stages of a running truths work are, the least advanced first. */
const STAGE_PLACE: Readonly<Record<string, number>> = { triage: 0, extract: 1, settle: 4 }

/**
 * How far a part's truths work is, the least advanced first: a part that failed needs the founder first; then a part that waits for
 * credits; then triage, the truth reading, a part an earlier build parked for the critic (`awaiting_critique`, no longer written: the
 * tick lets it go on), the settle, the wait for room under the ceiling, a part read the old way (`legacy`); `done` last.
 */
const placeOf = (truths: DocumentTruthsView): number => {
    if (truths.state === "failed") return -2
    if (truths.state === "blocked_credits") return -1
    if (truths.state === "running") return STAGE_PLACE[truths.stage ?? "triage"] ?? 0
    if (truths.state === "awaiting_critique") return 3
    if (truths.state === "at_ceiling") return 5
    // A part read the old way has ended, but before `done`: a document with such a part offers "read again" until every part is new.
    if (truths.state === "legacy") return 6
    return 7
}

/**
 * The truths state of a document cut into parts (a file over 120,000 characters), rolled up into the one row the documents page
 * shows: every count is the sum over the parts, and the state, stage and note are those of the LEAST advanced part (a part whose
 * truths work has not started counts as the start of triage), so the document reads `done` only when every part is. Null when no
 * part has a truths state yet; one part is itself.
 */
export const rolledUpTruthsOf = (parts: ReadonlyArray<MaybeDocumentTruths>): MaybeDocumentTruths => {
    if (parts.every((part) => part === null)) return null
    const all = parts.map((part) => part ?? NOT_STARTED)
    const [first, ...rest] = all
    if (first === undefined) return null
    if (parts.length === 1) return first
    const lead = rest.reduce((least, one) => (placeOf(one) < placeOf(least) ? one : least), first)
    const sum = (pick: (truths: DocumentTruthsView) => number): number =>
        all.reduce((total, one) => total + pick(one), 0)
    return {
        state: lead.state,
        stage: lead.stage,
        // A finished document still says what happened in any part (calls skipped, lines refused, truths waiting for the founder).
        note: lead.note ?? (lead.state === "done" ? (all.find((one) => one.note !== null)?.note ?? null) : null),
        passagesTotal: sum((one) => one.passagesTotal),
        passagesTriaged: sum((one) => one.passagesTriaged),
        passagesKept: sum((one) => one.passagesKept),
        callsDone: sum((one) => one.callsDone),
        callsTotal: sum((one) => one.callsTotal),
        truthsFound: sum((one) => one.truthsFound),
        truthsInForce: sum((one) => one.truthsInForce),
        truthsAsked: sum((one) => one.truthsAsked),
        truthsWaiting: sum((one) => one.truthsWaiting),
        callsSkipped: sum((one) => one.callsSkipped),
        linesRefused: sum((one) => one.linesRefused),
        linesUnread: sum((one) => one.linesUnread ?? 0),
        ...natureOf(rolledUpNatureOf(all.map((one) => one.nature ?? null))),
    }
}

/** The nature field of a rolled-up state: absent while no part was judged. */
const natureOf = (nature: DocumentNatureView | null): Pick<DocumentTruthsView, "nature"> => (nature === null ? {} : { nature })

/**
 * What a document cut into parts is: each part is judged on its own text, so parts that agree give their judgement (the first part's
 * reason); parts that differ make the document mixed, each part counted as a section (a part of rules, or a mixed part, counts as rule
 * material). Null while no part was judged.
 */
export const rolledUpNatureOf = (parts: ReadonlyArray<DocumentNatureView | null>): DocumentNatureView | null => {
    const judged = parts.filter((part): part is DocumentNatureView => part !== null)
    const [first] = judged
    if (first === undefined) return null
    if (judged.every((part) => part.nature === first.nature && part.by === first.by)) return first
    return {
        nature: "mixed",
        by: judged.every((part) => part.by === "founder") ? "founder" : "model",
        reason: first.reason,
        modelNature: null,
        ruleSections: judged.filter((part) => part.nature === "rules" || part.nature === "mixed").length,
        sections: judged.length,
    }
}
