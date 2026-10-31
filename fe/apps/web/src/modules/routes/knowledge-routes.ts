/** The tabs of the Second Brain page, in the order they are drawn. */
export const BRAIN_TABS = ["dossiers", "sources", "review", "facts", "lessons", "gaps", "agents"] as const

/** One tab of the Second Brain page. */
export type BrainTab = (typeof BRAIN_TABS)[number]

/** The tab the page opens on when the address names none. */
export const DEFAULT_BRAIN_TAB: BrainTab = "dossiers"

/** Extra address parameters of a Second Brain tab (the document filter, the add drawer, the fact form). */
type BrainParams = Readonly<Record<string, string | undefined>>

/** The address of one tab of the Second Brain, with the parameters that open a form or filter a list. */
export const brainTabHref = (tab: BrainTab, params: BrainParams = {}): string => {
    const query = new URLSearchParams({ tab })
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, value)
    })
    return `/brain?${query.toString()}`
}

/** The knowledge and Second Brain destinations, named once. The documents live on the sources tab of the one page. */
export const KNOWLEDGE_ROUTES = {
    library: brainTabHref("sources"),
    nivo: "/knowledge/nivo",
    brain: "/brain",
} as const

/** The detail page of one document. */
export const knowledgeSourceHref = (sourceId: string): string => `/knowledge/${encodeURIComponent(sourceId)}`
