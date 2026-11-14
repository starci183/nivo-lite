import type { AgentConnections, AgentKnowledge } from "@nivo-lite/agent-sdk/platform"

/** The connections region a person sees: the providers attached to the agent. */
export type ConnectionsRegion = Awaited<ReturnType<AgentConnections["of"]>>

/** The knowledge region a person sees. */
export type KnowledgeRegion = Awaited<ReturnType<AgentKnowledge["of"]>>

/** The message key of a word of the regions, by the group it belongs to and the value (`connections.title`). */
export const regionKey = (group: string, value: string): string => `workbench.platform.${group}.${value}`

/** The most gaps the knowledge card lists. */
export const GAPS_SHOWN = 5

/** What stands between two tool groups of one provider on its row. */
export const ABILITY_SEPARATOR = " · "

/** A label in the two languages of the provider rights. */
export interface BilingualLabel {
    /** The Vietnamese words. */
    readonly vi: string
    /** The English words. */
    readonly en: string
}

/** The words of a label in the viewer's language: Vietnamese, else English. */
export const pick = (label: BilingualLabel, locale: string): string => (locale === "vi" ? label.vi : label.en)

/** One group of the tools a provider serves, as the region lists it (information, not a right). */
export interface ProviderAbility {
    /** The ability's id, as the provider names it. */
    readonly id: string
    /** The ability's name in both languages. */
    readonly label: BilingualLabel
    /** Whether the ability only reads or also writes. */
    readonly scope: "read" | "write"
}

/**
 * The level an attached account gives the agent, as the raw value the readers of a bank feed take: `attached` (the agent may reach every
 * tool its provider serves; the mode of each call is its node's, nivo-frame `rights`).
 */
export const ATTACHED_ACCESS = "attached"
