import type {
    ConnectionsRegionView,
    DecisionQueueView,
    DecisionRowView,
    ItemsRegionView,
    KnowledgeGapsView,
    KnowledgeRegionView,
    WhyView,
} from "./views.types"

const BLANK = "........"
const PLACEHOLDER_ROWS = 3

/** The ids of the rows a skeleton draws. */
const rowIds: ReadonlyArray<string> = Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => `placeholder-${index}`)

/** A finished or waiting region with the geometry of a settled one. */
export const ITEMS_REGION_PLACEHOLDER: ItemsRegionView = {
    count: BLANK,
    rows: rowIds.map((id) => ({ id, title: BLANK, description: BLANK, href: "#" })),
    linkLabel: BLANK,
    linkHref: "#",
    more: null,
}

/** The connections region with the geometry of a settled one. */
export const CONNECTIONS_REGION_PLACEHOLDER: ConnectionsRegionView = {
    label: "",
    rightsLabel: BLANK,
    rightsHref: "#",
    rows: rowIds.map((id) => ({ id, name: BLANK, description: BLANK, provider: "" })),
}

/** The knowledge gaps card with the geometry of a settled one. */
export const KNOWLEDGE_GAPS_PLACEHOLDER: KnowledgeGapsView = {
    label: BLANK,
    count: BLANK,
    openLabel: BLANK,
    openHref: "#",
    rows: rowIds.map((id) => ({ id, title: BLANK, description: BLANK, asked: BLANK })),
}

/** The knowledge region with the geometry of a settled one. */
export const KNOWLEDGE_REGION_PLACEHOLDER: KnowledgeRegionView = {
    openLabel: BLANK,
    openHref: "#",
    footer: BLANK,
    publicTitle: BLANK,
    publicDescription: BLANK,
    internalTitle: BLANK,
    internalDescription: BLANK,
    gaps: KNOWLEDGE_GAPS_PLACEHOLDER,
}

const DECISION_ROW_PLACEHOLDER: DecisionRowView = {
    id: BLANK,
    title: BLANK,
    description: BLANK,
    badges: [],
    reason: null,
    amount: null,
    proposal: BLANK,
    trace: null,
    expiry: null,
    primary: null,
    edit: null,
    menu: [],
    waitingFor: BLANK,
}

/** The decision queue with the geometry of a settled one. */
export const DECISION_QUEUE_PLACEHOLDER: DecisionQueueView = {
    count: null,
    more: null,
    rows: rowIds.map((id) => ({ ...DECISION_ROW_PLACEHOLDER, id })),
}

/** The why pane with the geometry of a settled one. */
export const WHY_PLACEHOLDER: WhyView = {
    heading: BLANK,
    branch: BLANK,
    reason: BLANK,
    path: rowIds.map((id) => ({ id, title: BLANK, description: BLANK, isCurrent: false })),
    facts: [],
    sources: [],
    approver: null,
    mapHref: "#",
}
