import type { FindingEvidence, FindingResolution } from "./dossier-review.contracts"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import { citedIds, coverageKey } from "./fingerprint.policy"

/** The note a finding takes when it comes back with other evidence, or after it was resolved. */
export const REOPEN_NOTES = { evidence: "new evidence", detected: "re-detected" } as const

/** A candidate with its identity worked out. */
export interface PreparedCandidate {
    /** The candidate, with its title and detail rendered. */
    readonly candidate: FindingCandidate
    /** Its fingerprint. */
    readonly fingerprint: string
    /** Its evidence hash. */
    readonly evidenceHash: string
}

/** What the reconciliation reads of a stored finding. */
export interface StoredFinding {
    /** The finding id. */
    readonly id: string
    /** Its fingerprint. */
    readonly fingerprint: string
    /** Rule or model. */
    readonly origin: "rule" | "ai"
    /** The rule that produced it. */
    readonly ruleKey: string
    /** The dossier it is filed under. */
    readonly dossierId: string | null
    /** Its lifecycle state. */
    readonly status: "open" | "confirmed" | "dismissed" | "resolved"
    /** The hash of its evidence. */
    readonly evidenceHash: string
    /** The hash when it was dismissed. */
    readonly dismissedEvidenceHash: string | null
    /** How many times it came back. */
    readonly reopenedCount: number
    /** What completes it. */
    readonly remedyAction: string
}

/** The columns a reconciliation may change on a stored finding. */
export interface FindingChanges {
    /** The kind. */
    readonly kind?: string
    /** The severity. */
    readonly severity?: string
    /** The message code. */
    readonly code?: string | null
    /** The message params. */
    readonly params?: Record<string, string>
    /** The title. */
    readonly title?: string
    /** The detail. */
    readonly detail?: string
    /** The evidence. */
    readonly evidence?: Array<FindingEvidence>
    /** The hash of the evidence. */
    readonly evidenceHash?: string
    /** The sources the evidence cites. */
    readonly sourceIds?: Array<string>
    /** The facts the evidence cites. */
    readonly factIds?: Array<string>
    /** The other dossiers it touches. */
    readonly relatedDossierIds?: Array<string>
    /** What completes it. */
    readonly remedyAction?: string
    /** The document that completes it. */
    readonly remedyDocumentType?: string | null
    /** The run that last saw it. */
    readonly lastSeenRunId: string | null
    /** When it was last seen. */
    readonly lastSeenAt: Date
    /** Its new lifecycle state. */
    readonly status?: "open" | "resolved"
    /** Why it is resolved, or null when it opens again. */
    readonly resolution?: FindingResolution | null
    /** When it was resolved. */
    readonly resolvedAt?: Date | null
    /** How many times it came back. */
    readonly reopenedCount?: number
    /** The note of what happened. */
    readonly decisionNote?: string
}

/** The change of one stored finding. */
export interface FindingChange {
    /** The finding id. */
    readonly id: string
    /** The columns it changes. */
    readonly changes: FindingChanges
}

/** What a reconciliation reads. */
export interface ReconcileInput {
    /** The run. */
    readonly runId: string
    /** The instant of the run. */
    readonly now: Date
    /** What started the run. */
    readonly trigger: string
    /** The stored findings of the evaluated dossiers. */
    readonly stored: ReadonlyArray<StoredFinding>
    /** The verified candidates. */
    readonly candidates: ReadonlyArray<PreparedCandidate>
    /** The (rule, dossier) pairs the rules evaluated. */
    readonly coverage: ReadonlySet<string>
    /** The fingerprints of model findings the model resolved with verified evidence. */
    readonly aiResolved: ReadonlySet<string>
}

/** What a reconciliation decided. */
export interface Reconciliation {
    /** The candidates to store as new findings. */
    readonly inserts: ReadonlyArray<PreparedCandidate>
    /** The changes to stored findings. */
    readonly changes: ReadonlyArray<FindingChange>
    /** How many findings were opened (new ones and those that came back). */
    readonly opened: number
    /** How many findings were resolved. */
    readonly resolved: number
}

const refreshOf = (item: PreparedCandidate, input: ReconcileInput): FindingChanges => {
    const cited = citedIds(item.candidate.evidence)
    return {
        kind: item.candidate.kind,
        severity: item.candidate.severity,
        code: item.candidate.code,
        params: { ...item.candidate.params },
        title: item.candidate.title,
        detail: item.candidate.detail,
        evidence: [...item.candidate.evidence],
        evidenceHash: item.evidenceHash,
        sourceIds: cited.sources,
        factIds: cited.facts,
        relatedDossierIds: [...item.candidate.relatedDossierIds],
        remedyAction: item.candidate.remedyAction,
        remedyDocumentType: item.candidate.remedyDocumentType,
        lastSeenRunId: input.runId,
        lastSeenAt: input.now,
    }
}

const resolutionOf = (stored: StoredFinding, trigger: string): FindingResolution =>
    stored.origin === "ai" || (stored.remedyAction === "upload" && trigger === "document") ? "document" : "not_detected"

/**
 * Sets the stored findings against what the run found: a new candidate is inserted; a known one is refreshed in place; a dismissed one
 * stays dismissed while its evidence is the same and reopens when it changed; a resolved one that is found again opens again. A rule
 * finding no longer found is resolved only where its rule was evaluated for its dossier; a model finding only when the model resolved it
 * with verified evidence, never by being forgotten.
 */
/** One stored finding against what the run found: the change it takes, and whether it opened or resolved. */
interface StoredOutcome {
    /** The change, or null when it takes none. */
    readonly change: FindingChange | null
    /** 1 when it opened. */
    readonly opened: number
    /** 1 when it resolved. */
    readonly resolved: number
}

const NO_CHANGE: StoredOutcome = { change: null, opened: 0, resolved: 0 }

const missingOutcome = (stored: StoredFinding, input: ReconcileInput): StoredOutcome => {
    const covered =
        stored.origin === "ai"
            ? input.aiResolved.has(stored.fingerprint)
            : input.coverage.has(coverageKey(stored.ruleKey, stored.dossierId))
    if (!covered || (stored.status !== "open" && stored.status !== "confirmed")) return NO_CHANGE
    return {
        change: {
            id: stored.id,
            changes: {
                lastSeenRunId: input.runId,
                lastSeenAt: input.now,
                status: "resolved",
                resolution: resolutionOf(stored, input.trigger),
                resolvedAt: input.now,
            },
        },
        opened: 0,
        resolved: 1,
    }
}

const foundOutcome = (stored: StoredFinding, found: PreparedCandidate, input: ReconcileInput): StoredOutcome => {
    const refresh = refreshOf(found, input)
    if (stored.status === "dismissed" && stored.dismissedEvidenceHash === found.evidenceHash) {
        return {
            change: { id: stored.id, changes: { lastSeenRunId: input.runId, lastSeenAt: input.now } },
            opened: 0,
            resolved: 0,
        }
    }
    if (stored.status === "dismissed") {
        const changes = {
            ...refresh,
            status: "open",
            reopenedCount: stored.reopenedCount + 1,
            decisionNote: REOPEN_NOTES.evidence,
        } as const
        return { change: { id: stored.id, changes }, opened: 1, resolved: 0 }
    }
    if (stored.status === "resolved") {
        const changes = {
            ...refresh,
            status: "open",
            resolution: null,
            resolvedAt: null,
            reopenedCount: stored.reopenedCount + 1,
            decisionNote: REOPEN_NOTES.detected,
        } as const
        return { change: { id: stored.id, changes }, opened: 1, resolved: 0 }
    }
    return { change: { id: stored.id, changes: refresh }, opened: 0, resolved: 0 }
}

/**
 * Sets the stored findings against what the run found: a new candidate is inserted; a known one is refreshed in place; a dismissed one
 * stays dismissed while its evidence is the same and reopens when it changed; a resolved one that is found again opens again. A rule
 * finding no longer found is resolved only where its rule was evaluated for its dossier; a model finding only when the model resolved it
 * with verified evidence, never by being forgotten.
 */
export const reconcile = (input: ReconcileInput): Reconciliation => {
    const byFingerprint = new Map<string, PreparedCandidate>()
    for (const item of input.candidates) {
        if (!byFingerprint.has(item.fingerprint)) byFingerprint.set(item.fingerprint, item)
    }
    const known = new Set(input.stored.map((stored) => stored.fingerprint))
    const outcomes = input.stored.map((stored) => {
        const found = byFingerprint.get(stored.fingerprint)
        return found === undefined ? missingOutcome(stored, input) : foundOutcome(stored, found, input)
    })
    const inserts = [...byFingerprint.values()].filter((item) => !known.has(item.fingerprint))
    return {
        inserts,
        changes: outcomes.flatMap((outcome) => (outcome.change === null ? [] : [outcome.change])),
        opened: outcomes.reduce((sum, outcome) => sum + outcome.opened, inserts.length),
        resolved: outcomes.reduce((sum, outcome) => sum + outcome.resolved, 0),
    }
}
