/** The queue name: the contract between the database function that submits a command and the processor of the shifts-command job (a pgmq queue name). */
export const SHIFTS_COMMAND_QUEUE = "shifts_command"

/** The payload of one shifts-command job: the submitted command to run. */
export interface ShiftsCommandPayload {
    /** The workspace the command acts in. */
    readonly workspaceId: string
    /** The command row to run. */
    readonly commandId: string
}

/** True when a job payload is the payload of an shifts-command job. */
export const isShiftsCommandPayload = (value: unknown): value is ShiftsCommandPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "commandId" in value &&
    typeof value.commandId === "string"
