/** The tabs of the Second Brain page, in the order they are drawn. */
export const BRAIN_TABS = ["todo", "dossiers", "sources", "map", "facts", "lessons", "agents"] as const

/** One tab of the Second Brain page. */
export type BrainTab = (typeof BRAIN_TABS)[number]

/** The tab the page opens on when the address names none. */
export const DEFAULT_BRAIN_TAB: BrainTab = "todo"

/** The tabs the page used to have: what waited for review and the customer questions are now the one queue of the to do tab. */
export const LEGACY_BRAIN_TABS: ReadonlyArray<string> = ["review", "gaps"]

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

/** What the address of a dossier may carry besides the dossier: the finding in view and the draft that is open. */
interface DossierParams {
    readonly finding?: string | undefined
    readonly draft?: string | undefined
}

/** The address of one dossier on the dossiers tab, with the finding in view and the draft open when they are named. */
export const brainDossierHref = (dossierId: string, params: DossierParams = {}): string =>
    brainTabHref("dossiers", { dossier: dossierId, finding: params.finding, draft: params.draft })

/** The address of the add documents drawer on the sources tab, preset with the topic and the tag that file the document under a dossier. */
export const brainUploadHref = (topic: string, tag: string): string =>
    brainTabHref("sources", { add: "upload", topic, tag })
