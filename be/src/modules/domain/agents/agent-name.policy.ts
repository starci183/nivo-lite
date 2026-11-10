import type { AgentIdentityRules, OptionalCleanText } from "./agent-name.contracts"

/** The limits of the display name of an agent, after trimming. */
export const AGENT_DISPLAY_NAME_LIMITS = { min: 2, max: 40 } as const

/**
 * The display name of an agent as the owner typed it: free text (any name, it never encodes the role), trimmed with runs of
 * whitespace folded to one space; null when it is shorter or longer than the limits.
 */
export const cleanAgentName = (name: string): OptionalCleanText => {
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

/** The limits of an @handle, without the at sign. */
export const AGENT_HANDLE_LIMITS = { min: 2, max: 32 } as const

/** A handle starts with a letter; the slug already holds only lowercase letters, digits and single hyphens ("sales-lan"). */
const HANDLE_START = /^[a-z]/u

/**
 * The handle-shaped text of what the owner typed, with no length limit: the at sign and the outer spaces dropped, lowercased,
 * Vietnamese marks folded (the barred d to "d"), every run of other characters turned into one hyphen, no hyphen at either end.
 */
export const handleSlugOf = (typed: string): string =>
    typed
        .trim()
        .replace(/^@+/u, "")
        .toLowerCase()
        .replace(/\u0111/gu, "d")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .split(/[^a-z0-9]+/u)
        .filter((part) => part !== "")
        .join("-")

/** The @handle as the owner typed it, cleaned (see handleSlugOf); null when what is left is not a handle within its limits. */
export const cleanAgentHandle = (typed: string): OptionalCleanText => {
    const folded = handleSlugOf(typed)
    return folded.length >= AGENT_HANDLE_LIMITS.min &&
        folded.length <= AGENT_HANDLE_LIMITS.max &&
        HANDLE_START.test(folded)
        ? folded
        : null
}

/** The preset pictures an agent may wear instead of an upload: the NIVO AI mark, its role's 3D mark, its initials, the shop marks. */
export const AGENT_AVATAR_PRESETS: ReadonlyArray<string> = [
    "nivo-ai",
    "role",
    "initials",
    "mascot",
    "mascot-chat",
    "mascot-point",
    "mascot-offer",
]

/** Whether a preset key is one an agent may wear. */
export const isAgentAvatarPreset = (key: string): boolean => AGENT_AVATAR_PRESETS.includes(key)

/** The rules of who an agent is (its name, its handle, its preset picture), as the capabilities that create agents check them. */
export const AGENT_IDENTITY_RULES: AgentIdentityRules = {
    nameLimits: AGENT_DISPLAY_NAME_LIMITS,
    handleLimits: AGENT_HANDLE_LIMITS,
    cleanName: cleanAgentName,
    cleanHandle: cleanAgentHandle,
    handleSlug: handleSlugOf,
    isAvatarPreset: isAgentAvatarPreset,
}
