/** The knowledge and Second Brain destinations, named once. */
export const KNOWLEDGE_ROUTES = {
    library: "/knowledge",
    nivo: "/knowledge/nivo",
    brain: "/brain",
} as const

/** The detail page of one document. */
export const knowledgeSourceHref = (sourceId: string): string => `/knowledge/${encodeURIComponent(sourceId)}`
