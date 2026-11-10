/** The two parts of the Second Brain: what only the team and the internal agents read, and what the chatbot may tell customers. */
export const BRAIN_PARTS = ["internal", "public"] as const

/** One part of the Second Brain. */
export type BrainPart = (typeof BRAIN_PARTS)[number]

/** The tabs of each part, in the order they are drawn. The part a tab sits in decides who can read what is added there. */
export const BRAIN_PART_TABS = {
    internal: ["todo", "dossiers", "sources", "map", "facts", "lessons", "agents"],
    public: ["publicDocs", "publicAsks", "publicTry"],
} as const

/** The tabs of the Second Brain page, in the order they are drawn: the internal part first. */
export const BRAIN_TABS: readonly [
    "todo",
    "dossiers",
    "sources",
    "map",
    "facts",
    "lessons",
    "agents",
    "publicDocs",
    "publicAsks",
    "publicTry",
] = [...BRAIN_PART_TABS.internal, ...BRAIN_PART_TABS.public] as const

/** One tab of the Second Brain page. */
export type BrainTab = (typeof BRAIN_TABS)[number]

/** The four tabs of the page header, by what the owner does there: the inbox, the knowledge the agents read, what customers hear, and a try. */
export const BRAIN_STRIP_TABS = ["todo", "knowledge", "public", "ask"] as const

/** One tab of the strip. */
export type BrainStripTab = (typeof BRAIN_STRIP_TABS)[number]

/** The chips of the knowledge tab, in order: the facts, the documents, the dossiers and the lessons. */
export const KNOWLEDGE_CHIPS = ["facts", "sources", "dossiers", "lessons"] as const

/** One chip of the knowledge tab. */
export type KnowledgeChip = (typeof KNOWLEDGE_CHIPS)[number]

/** Where a page of the Second Brain lives in the address: the tab of the strip, and the view inside it (a chip, the map, the questions). */
interface BrainAddress {
    readonly tab: BrainStripTab
    readonly view?: string
}

/** The address of every page of the Second Brain. The first page of a strip tab carries no view, except the knowledge chips, which name theirs (a knowledge address with no view opens the facts). */
const BRAIN_ADDRESS: Readonly<Record<BrainTab, BrainAddress>> = {
    todo: { tab: "todo" },
    sources: { tab: "knowledge", view: "documents" },
    facts: { tab: "knowledge", view: "facts" },
    dossiers: { tab: "knowledge", view: "dossiers" },
    map: { tab: "knowledge", view: "map" },
    lessons: { tab: "knowledge", view: "lessons" },
    publicDocs: { tab: "public" },
    publicAsks: { tab: "public", view: "asks" },
    publicTry: { tab: "ask" },
    agents: { tab: "ask", view: "agents" },
}

/** The tab of the strip a page of the Second Brain lights. */
export const brainStripTabOf = (tab: BrainTab): BrainStripTab => BRAIN_ADDRESS[tab].tab

/** The page each tab of the strip opens on. */
export const FIRST_PAGE: Readonly<Record<BrainStripTab, BrainTab>> = {
    todo: "todo",
    knowledge: "facts",
    public: "publicDocs",
    ask: "publicTry",
}

/**
 * The page an address names (`?tab=knowledge&view=facts`), or undefined when it names none of today's tabs. A strip tab with no view,
 * or a view it does not know, opens its first page.
 */
export const brainTabOfAddress = (tab: string | undefined, view: string | undefined): BrainTab | undefined => {
    const strip = BRAIN_STRIP_TABS.find((one) => one === tab)
    if (strip === undefined) return undefined
    const named = BRAIN_TABS.find((one) => BRAIN_ADDRESS[one].tab === strip && BRAIN_ADDRESS[one].view === view)
    return named ?? FIRST_PAGE[strip]
}

/** The tab the page opens on when the address names none. */
export const DEFAULT_BRAIN_TAB: BrainTab = "todo"

/**
 * The tabs the page used to have and the page each now is: what waited for review and the customer questions are the to-do inbox; every
 * other old tab name is a page of today's strip, under its tab and view.
 */
export const LEGACY_BRAIN_TABS: Readonly<Record<string, BrainTab>> = {
    review: "todo",
    gaps: "todo",
    sources: "sources",
    facts: "facts",
    dossiers: "dossiers",
    map: "map",
    lessons: "lessons",
    agents: "agents",
    publicDocs: "publicDocs",
    publicAsks: "publicAsks",
    publicTry: "publicTry",
}

/** Extra address parameters of a Second Brain tab (the document filter, the add drawer, the fact form). */
type BrainParams = Readonly<Record<string, string | undefined>>

/** The address of one page of the Second Brain (its tab and view), with the parameters that open a form or filter a list. */
export const brainTabHref = (tab: BrainTab, params: BrainParams = {}): string => {
    const address = BRAIN_ADDRESS[tab]
    const query = new URLSearchParams({ tab: address.tab })
    if (address.view !== undefined) query.set("view", address.view)
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && key !== "tab" && key !== "view") query.set(key, value)
    })
    return `/brain?${query.toString()}`
}

type KnowledgeRoutesShape = {
    readonly library: string
    readonly nivo: "/knowledge/nivo"
    readonly brain: "/brain"
}

/** The knowledge and Second Brain destinations, named once. The documents live on the sources tab of the one page. */
export const KNOWLEDGE_ROUTES: KnowledgeRoutesShape = {
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
