import type { NewAgent } from "./agents.contracts"

/** A cleaned text (a name, a handle), or null when what was typed does not hold. */
export type OptionalCleanText = string | null

/** The shortest and the longest a cleaned text may be. */
export interface AgentTextLimits {
    /** The fewest characters. */
    readonly min: number
    /** The most characters. */
    readonly max: number
}

/** The rules of who an agent is, as the capabilities that create agents check them. */
export interface AgentIdentityRules {
    /** The limits of a display name, after trimming. */
    readonly nameLimits: AgentTextLimits
    /** The limits of a handle, without the at sign. */
    readonly handleLimits: AgentTextLimits
    /** The display name as typed, cleaned; null when it does not hold. */
    readonly cleanName: (name: string) => OptionalCleanText
    /** The handle as typed, cleaned; null when it does not hold. */
    readonly cleanHandle: (typed: string) => OptionalCleanText
    /** The handle-shaped text of what was typed, with no length limit. */
    readonly handleSlug: (typed: string) => string
    /** Whether a preset key is one an agent may wear. */
    readonly isAvatarPreset: (key: string) => boolean
}

/** A preset picture key, or null for the default (the sprout). */
export type OptionalAvatarPreset = string | null

/** The role an agent is named by when no name is given: its default name is "Agent <label> #<generated id>". */
export interface DefaultAgentName {
    /** The role label in the owner's language ("Chatbot", "Sales", "Accounting"). */
    readonly label: string
}

/** What adding an agent takes: a typed display name, or the role its default name is made from. */
export interface NewNamedAgent extends Omit<NewAgent, "name"> {
    /** The display name, or the role its default name is made from. */
    readonly name: string | DefaultAgentName
}
