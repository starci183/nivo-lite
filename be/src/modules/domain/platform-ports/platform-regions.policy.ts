import type { AgentConnections, AgentKnowledge } from "@nivo-lite/blocks-core/modules"

/** The connections region a person sees: the providers attached to the agent. */
export type ConnectionsRegion = Awaited<ReturnType<AgentConnections["of"]>>

/** The knowledge region a person sees. */
export type KnowledgeRegion = Awaited<ReturnType<AgentKnowledge["of"]>>

/** The message key of a word of the regions, by the group it belongs to and the value (`connections.title`). */
export const regionKey = (group: string, value: string): string => `workbench.platform.${group}.${value}`

/** The most gaps the knowledge card lists. */
export const GAPS_SHOWN = 5

/** What stands between two abilities of one provider on its row. */
export const ABILITY_SEPARATOR = " · "

/** A label in the two languages of the provider rights. */
export interface BilingualLabel {
    readonly vi: string
    readonly en: string
}

/** The words of a label in the viewer's language: Vietnamese, else English. */
export const pick = (label: BilingualLabel, locale: string): string => (locale === "vi" ? label.vi : label.en)

/** One ability of a provider as the rights list it. */
export interface ProviderAbility {
    readonly id: string
    readonly label: BilingualLabel
    readonly scope: "read" | "write"
}

/** One ability the agent holds on a provider, with its mode. */
export interface HeldAbility extends ProviderAbility {
    readonly mode: "auto" | "ask"
}

/** The abilities of a provider the attachment ticks, in the provider's own order, each with its mode; an ability not ticked is left out. */
export const abilitiesHeld = (
    abilities: ReadonlyArray<ProviderAbility>,
    ticks: Readonly<Record<string, string>>,
): ReadonlyArray<HeldAbility> =>
    abilities.flatMap((ability) => {
        const mode = ticks[ability.id]
        return mode === "auto" || mode === "ask" ? [{ ...ability, mode }] : []
    })

/**
 * The highest level the agent holds on a provider, as the raw value the readers of a bank feed take: `auto` when a write ability acts
 * alone, `ask` when a write ability waits for a person, `read` when it only reads; null when it holds no ability.
 */
export const accessOf = (held: ReadonlyArray<HeldAbility>): "read" | "ask" | "auto" | null => {
    const writes = held.filter((ability) => ability.scope === "write")
    if (writes.some((ability) => ability.mode === "auto")) return "auto"
    if (writes.length > 0) return "ask"
    return held.length > 0 ? "read" : null
}
