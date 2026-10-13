const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** The id of the command a job payload names, or null when the payload names none. */
export const commandIdOf = (payload: unknown): string | null => {
    if (typeof payload !== "object" || payload === null || !("commandId" in payload)) return null
    const { commandId } = payload
    return typeof commandId === "string" && UUID.test(commandId) ? commandId : null
}
