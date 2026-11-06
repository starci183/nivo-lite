import type { ConnectionsRegionView, ItemsRegionView, KnowledgeRegionView } from "../../../views/views.types"
import type { ModuleFixtures } from "../../module-fixtures"

/** What the agent finished in the last seven days. */
export const DONE_VIEW: ItemsRegionView = {
    count: "42",
    rows: [
        { id: "d1", title: "So\u1ea1n b\u00e1o gi\u00e1 cho Hoa Sen Spa", description: "H\u00f4m nay", href: "" },
        { id: "d2", title: "Nh\u1eafc l\u1ecbch cho ch\u1ecb H\u1ea1nh", description: "H\u00f4m qua", href: "" },
    ],
    linkLabel: "",
    linkHref: "",
    more: "+40",
}

/** The agent has finished nothing yet. */
export const DONE_NONE: ItemsRegionView = { count: null, rows: [], linkLabel: "", linkHref: "", more: null }

/** Two connections bound to the agent. */
export const CONNECTIONS_VIEW: ConnectionsRegionView = {
    manageLabel: "Qu\u1ea3n l\u00fd k\u1ebft n\u1ed1i",
    manageHref: "",
    rows: [
        {
            id: "zalo",
            name: "Zalo OA",
            description: "Nh\u1eadn v\u00e0 tr\u1ea3 l\u1eddi tin nh\u1eafn c\u1ee7a kh\u00e1ch",
            statusLabel: "\u0110\u00e3 k\u1ebft n\u1ed1i",
            statusTone: "success",
            accessLabel: "\u0110\u1ecdc v\u00e0 g\u1eedi",
        },
        {
            id: "sepay",
            name: "SePay",
            description: "\u0110\u1ecdc giao d\u1ecbch ng\u00e2n h\u00e0ng",
            statusLabel: "\u0110\u00e3 k\u1ebft n\u1ed1i",
            statusTone: "success",
            accessLabel: "Ch\u1ec9 \u0111\u1ecdc",
        },
    ],
}

/** The agent has no connection. */
export const CONNECTIONS_NONE: ConnectionsRegionView = {
    manageLabel: "Qu\u1ea3n l\u00fd k\u1ebft n\u1ed1i",
    manageHref: "",
    rows: [],
}

/** What the agent knows, with one open gap. */
export const KNOWLEDGE_VIEW: KnowledgeRegionView = {
    openLabel: "M\u1edf Tri th\u1ee9c",
    openHref: "",
    footer: "Kh\u00e1ch ch\u1ec9 \u0111\u01b0\u1ee3c tr\u1ea3 l\u1eddi t\u1eeb ph\u1ea7n c\u00f4ng khai.",
    publicTitle: "C\u00f4ng khai",
    publicDescription: "14 t\u00e0i li\u1ec7u",
    internalTitle: "N\u1ed9i b\u1ed9",
    internalDescription: "6 t\u00e0i li\u1ec7u",
    gaps: {
        label: "C\u00e2u h\u1ecfi ch\u01b0a tr\u1ea3 l\u1eddi \u0111\u01b0\u1ee3c",
        count: "1",
        openLabel: "Xem t\u1ea5t c\u1ea3",
        openHref: "",
        rows: [
            {
                id: "g1",
                title: "Spa c\u00f3 m\u1edf c\u1eeda m\u00f9ng 2 T\u1ebft kh\u00f4ng?",
                description: "Kh\u00e1ch h\u1ecfi qua Zalo",
                asked: "2 l\u1ea7n",
            },
        ],
    },
}

/** What the agent knows, with no open gap. */
export const KNOWLEDGE_NONE: KnowledgeRegionView = { ...KNOWLEDGE_VIEW, gaps: null }

/** The platform reads in the states a prototype draws. The platform has no action. */
export const PLATFORM_FIXTURES: ModuleFixtures = {
    reads: {
        "platform.agent-done": { ready: DONE_VIEW, empty: DONE_NONE },
        "platform.agent-connections": { ready: CONNECTIONS_VIEW, empty: CONNECTIONS_NONE },
        "platform.agent-knowledge": { ready: KNOWLEDGE_VIEW, empty: KNOWLEDGE_NONE },
    },
    actions: {},
}
