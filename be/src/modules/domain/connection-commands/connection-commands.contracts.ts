import type { ErrorKind, ErrorParams } from "@modules/platform/errors"

/** One stored command, as the back end reads it. */
export interface ConnectionCommand {
    /** The id of the row. */
    readonly id: string
    /** The workspace the command acts in. */
    readonly workspaceId: string
    /** The signed-in member who submitted it. */
    readonly userId: string
    /** What to run (a key of the command table). */
    readonly kind: string
    /** The fields the kind takes, untrusted until the kind reads them. */
    readonly input: Readonly<Record<string, unknown>>
    /** `pending` until the outcome is written. */
    readonly status: "pending" | "done"
}

/** A command that worked: what the capability answered (`true` when it answered nothing). */
export interface CommandSucceeded {
    readonly ok: true
    readonly value: unknown
}

/** A command that failed: the stable code of the failure, how it travels and its text parameters. */
export interface CommandFailed {
    readonly ok: false
    readonly kind: ErrorKind
    readonly code: string
    readonly params: ErrorParams
}

/** What is written back to the row for the browser to take. */
export type CommandOutcome = CommandSucceeded | CommandFailed
