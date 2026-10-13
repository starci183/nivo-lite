/** Where a command stands. */
export type CommandStatus = "queued" | "running" | "done" | "failed"

/** One command a person asked for, as the runner reads it. */
export interface CommandRecord {
    /** The command id. */
    readonly id: string
    /** The workspace it was asked in. */
    readonly workspaceId: string
    /** The person who asked. */
    readonly requestedBy: string
    /** What was asked. */
    readonly kind: string
    /** The fields of the request. */
    readonly payload: unknown
    /** Where it stands. */
    readonly status: CommandStatus
}

/** What a command produced, or null when it produced nothing. */
export type CommandResult = object | null

/** A command, or null when there is none. */
export type MaybeCommand = CommandRecord | null
