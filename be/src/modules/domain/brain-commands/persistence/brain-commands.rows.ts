import type { CommandStatus } from "../brain-commands.contracts"

/** One row of public.brain_commands. */
export interface BrainCommandRow {
    /** The command id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The person who asked. */
    readonly requested_by: string
    /** What was asked. */
    readonly kind: string
    /** The fields of the request. */
    readonly payload: unknown
    /** Where it stands. */
    readonly status: CommandStatus
}

/** The id of a command that was changed. */
export interface CommandIdRow {
    /** The command id. */
    readonly id: string
}

/** How a command stands, as the person who asked reads it. */
export interface CommandStateRow {
    /** Where it stands. */
    readonly status: CommandStatus
    /** What it produced when it is done. */
    readonly result: object | null
    /** The stored code of why it failed. */
    readonly error_code: string | null
}
