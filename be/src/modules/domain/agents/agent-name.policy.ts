/** The limits of the display name of an agent, after trimming. */
export const AGENT_DISPLAY_NAME_LIMITS = { min: 2, max: 40 } as const

/**
 * The display name of an agent as the owner typed it: free text (any name, it never encodes the role), trimmed with runs of
 * whitespace folded to one space; null when it is shorter or longer than the limits.
 */
export const cleanAgentName = (name: string): string | null => {
    const clean = name.replace(/\s+/g, " ").trim()
    return clean.length >= AGENT_DISPLAY_NAME_LIMITS.min && clean.length <= AGENT_DISPLAY_NAME_LIMITS.max ? clean : null
}

/** Whether an address may be kept as an agent picture: HTTPS only, as the table's check and the member avatars require. */
export const isAgentAvatarUrl = (url: string): boolean => /^https:\/\/\S+$/u.test(url) && url.length <= 2048

/** The numbers a generated agent id takes: five digits, so the default name stays short ("Agent Chatbot #23233"). */
export const AGENT_SERIAL_RANGE = { min: 10_000, max: 99_999 } as const

/** How many times a creation draws a new id when the one drawn is already taken in the workspace. */
export const AGENT_SERIAL_ATTEMPTS = 8

/** The generated id of an agent: five digits taken from the tail of a fresh UUID, inside the range the table's check allows. */
export const agentSerialOf = (uuid: string): number =>
    AGENT_SERIAL_RANGE.min +
    (Number.parseInt(uuid.slice(-8), 16) % (AGENT_SERIAL_RANGE.max - AGENT_SERIAL_RANGE.min + 1))

/** The name an agent starts with: its role and its generated id. It never encodes a person; the owner renames it freely. */
export const defaultAgentName = (label: string, serial: number): string => `Agent ${label.trim()} #${serial}`
