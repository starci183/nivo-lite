/** Where a setup gate stands: nothing yet, proposed from the chat, or confirmed by the owner. */
export type GateStatus = "missing" | "proposed" | "confirmed"

/** The evidence of one setup gate. */
export interface GateEntry {
    /** Where the gate stands. */
    readonly status: GateStatus
    /** What the owner said, restated. */
    readonly evidence: string
    /** Who confirmed it. */
    readonly confirmed_by?: string
    /** When it was confirmed, ISO 8601. */
    readonly confirmed_at?: string
}

/** The evidence per gate key. */
export type GateEvidence = Readonly<Record<string, GateEntry>>

/** One short stable item the setup chat learned. */
export interface SetupFact {
    /** The key in snake case. */
    readonly key: string
    /** The text. */
    readonly text: string
}

/** The draft of a setup: the summary of the business and the facts learned. */
export interface DraftSnapshot {
    /** One to three sentences about the business. */
    readonly summary: string
    /** The facts learned. */
    readonly facts: ReadonlyArray<SetupFact>
}

/** What a version freezes: the draft and the confirmed gates only. */
export interface VersionSnapshot extends DraftSnapshot {
    /** The confirmed gates. */
    readonly gates: GateEvidence
}

/** One applied context version of an installation. */
export interface ContextVersionRecord {
    /** The version row. */
    readonly id: string
    /** The installation. */
    readonly installationId: string
    /** The number of the version, from 1. */
    readonly version: number
    /** What was frozen. */
    readonly snapshot: VersionSnapshot
    /** Who applied it. */
    readonly appliedBy: string
    /** When it was applied, ISO 8601. */
    readonly appliedAt: string
}

/** A version, or null when none matches. */
export type OptionalContextVersionRecord = ContextVersionRecord | null

/** What applying a setup stores. */
export interface NewContextVersion {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The number of the version. */
    readonly version: number
    /** What is frozen. */
    readonly snapshot: VersionSnapshot
    /** Who applied it. */
    readonly appliedBy: string
}
