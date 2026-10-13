/** One row of public.connection_commands as the back end reads it. */
export interface ConnectionCommandRow {
    /** The command id the caller polls for its result. */
    readonly id: string
    /** The workspace the command acts in; every effect stays inside it. */
    readonly workspace_id: string
    /** The member who issued the command, whose role authorises it. */
    readonly user_id: string
    /** The command kind that selects the handler. */
    readonly kind: string
    /** The raw input the handler parses; untrusted until the kind reads it. */
    readonly input: unknown
    /** Where the command is in its life: still pending or already settled. */
    readonly status: string
}
