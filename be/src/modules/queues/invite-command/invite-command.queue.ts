/** The queue name: the contract between `public.request_invite_command` / `public.request_admin_invite_resend` and the processor of the issue-invite job (a pgmq queue name). */
export const INVITE_COMMAND_QUEUE = "invite_command"

/** The payload of one invitation command: the row of `public.app_commands` that holds what was asked. */
export interface InviteCommandPayload {
    /** The `app_commands` row to serve. */
    readonly commandId: string
}

/** Reads a job payload as an invitation command; null when it names no command. */
export const inviteCommandPayloadOf = (value: object): InviteCommandPayload | null =>
    "commandId" in value && typeof value.commandId === "string" ? { commandId: value.commandId } : null
