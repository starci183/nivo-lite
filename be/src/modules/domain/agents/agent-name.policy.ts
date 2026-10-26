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
