/** The queue name: the contract between the definer functions that queue a loyalty command (job_enqueue) and the processor of the run-loyalty-command job (a pgmq queue name). */
export const LOYALTY_COMMAND_QUEUE = "loyalty_command"

/** The payload of one loyalty command: ids only; the job reads the `loyalty_commands` row itself. */
export interface LoyaltyCommandPayload {
    /** The workspace of the command. */
    readonly workspaceId: string
    /** The `loyalty_commands` row to run. */
    readonly commandId: string
}

/** Reads a job payload as a loyalty command, or null when it is not one. */
export const loyaltyCommandPayloadOf = (value: object): LoyaltyCommandPayload | null => {
    if (!("workspaceId" in value) || typeof value.workspaceId !== "string") return null
    if (!("commandId" in value) || typeof value.commandId !== "string") return null
    return { workspaceId: value.workspaceId, commandId: value.commandId }
}
