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
