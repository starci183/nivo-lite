import { createContext, type Context } from "react"
import { isRecord } from "./json-shape"

/** How fresh a level-1 answer of a provider is: `live` read from the outside system at the moment of the call, `synced` read from what NIVO stored the last time the provider's background work ran. */
export interface ReadFreshness {
    readonly source: "live" | "synced"
    /** As of when the answer holds, ISO 8601; null when the provider does not know. */
    readonly asOf: string | null
}

/** The freshness an answer states (`source`, `asOf`), or null for an answer that states none (a module read). */
export const freshnessOf = (answer: unknown): ReadFreshness | null => {
    if (!isRecord(answer)) return null
    const source = answer.source
    if (source !== "live" && source !== "synced") return null
    return { source, asOf: typeof answer.asOf === "string" ? answer.asOf : null }
}

/** Takes the freshness of the provider read of an operation when its answer settles; null when it goes. */
export type ReportFreshness = (operation: string, freshness: ReadFreshness | null) => void

/** Where a page that draws freshness (a data page) listens; absent elsewhere, where the answers need no such note. */
export const ReadFreshnessContext: Context<ReportFreshness | null> = createContext<ReportFreshness | null>(null)
