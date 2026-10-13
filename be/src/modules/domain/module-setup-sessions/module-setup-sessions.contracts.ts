import type { DraftSnapshot, GateEvidence } from "@modules/domain/module-context-versions"

/** Where a setup session stands. */
export type SetupSessionStatus = "draft" | "applied" | "discarded"

/** One setup session of an installation: the draft being built in the chat and the evidence per gate. */
export interface SetupSessionRecord {
    /** The session. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The revision, from 1. */
    readonly revision: number
    /** Where it stands. */
    readonly status: SetupSessionStatus
    /** The draft. */
    readonly draft: DraftSnapshot
    /** The evidence per gate. */
    readonly gateEvidence: GateEvidence
    /** When it was opened, ISO 8601. */
    readonly createdAt: string
}

/** A session, or null when none matches. */
export type OptionalSetupSessionRecord = SetupSessionRecord | null

/** One line of the history of an installation: a revision and how it ended. */
export interface SetupRevisionRecord {
    /** The session. */
    readonly id: string
    /** The revision. */
    readonly revision: number
    /** Where it stands. */
    readonly status: SetupSessionStatus
}

/** What opening a session takes. */
export interface NewSetupSession {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The revision. */
    readonly revision: number
    /** The draft it starts from. */
    readonly draft: DraftSnapshot
    /** The gate evidence it starts from. */
    readonly gateEvidence: GateEvidence
}

/** What a turn or a gate change stores on the open draft. */
export interface SetupSessionChange {
    /** The draft. */
    readonly draft: DraftSnapshot
    /** The evidence per gate. */
    readonly gateEvidence: GateEvidence
}
