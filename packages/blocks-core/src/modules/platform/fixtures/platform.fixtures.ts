import type { ConnectionsRegionView, ItemsRegionView, KnowledgeRegionView } from "../../../views/views.types"
import type { ModuleFixtures } from "../../module-fixtures"
import { PLATFORM_MESSAGES } from "../platform-messages"
import type { InstallationFacts, InstallationView, ParkedRunRow } from "../platform.types"

/** An installation with one enabled module and one the workspace has not enabled. */
export const INSTALLATION: InstallationView = {
    registryHash: "8f6b9c113b15db934d20405ff96ac98a8fe24a13b5dbd99ac70af5703629d39c",
    modules: [
        {
            key: "sales",
            enabled: true,
            permissions: ["sales.view", "sales.manage"],
            reads: ["sales.leads"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        {
            key: "loyalty",
            enabled: false,
            permissions: ["loyalty.view"],
            reads: ["loyalty.members"],
            actions: [],
            views: [],
        },
    ],
}

/** What the back end knows when it produces `INSTALLATION`: the same modules, with only `sales` enabled. */
export const INSTALLATION_FACTS: InstallationFacts = {
    registryHash: INSTALLATION.registryHash,
    modules: [
        {
            key: "sales",
            permissions: ["sales.view", "sales.manage"],
            reads: ["sales.leads"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        { key: "loyalty", permissions: ["loyalty.view"], reads: ["loyalty.members"], actions: [], views: [] },
    ],
    enabled: ["sales"],
}

/** The installation of a back end that runs no module. */
export const INSTALLATION_NONE: InstallationView = { registryHash: INSTALLATION.registryHash, modules: [] }

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

/** The view of two runs the engine parked, about two orders, with the words of one language of the platform messages. */
const parkedRunsIn = (words: Readonly<Record<string, string>>): ParkedRunsView => ({
    count: "2",
    rows: [
        {
            id: "run-2",
            module: "sales",
            subjectKind: "sales.order",
            subjectId: "order-2",
            step: words["parked_step_confirm"] ?? "",
            errorCode: "DELIVERY_FAILED",
            errorWords: words["parked_error_delivery_failed"] ?? "",
            parkedAt: "2026-11-04T10:30:00.000Z",
        },
        {
            id: "run-1",
            module: "sales",
            subjectKind: "sales.order",
            subjectId: "order-1",
            step: words["parked_step_notify"] ?? "",
            errorCode: "TIMEOUT",
            errorWords: words["parked_error_timeout"] ?? "",
            parkedAt: "2026-11-04T09:10:00.000Z",
        },
    ],
})

/** What platform.parked-runs answers. */
interface ParkedRunsView {
    readonly count: string | null
    readonly rows: ReadonlyArray<ParkedRunRow>
}

/** Two runs the engine parked, in the default language (Vietnamese): the words are those of the platform messages. */
export const PARKED_RUNS_VIEW: ParkedRunsView = parkedRunsIn(PLATFORM_MESSAGES.vi)

/** The same two parked runs in English. */
export const PARKED_RUNS_VIEW_EN: ParkedRunsView = parkedRunsIn(PLATFORM_MESSAGES.en)

/** No run is parked. */
export const PARKED_RUNS_NONE: { readonly count: null; readonly rows: ReadonlyArray<ParkedRunRow> } = {
    count: null,
    rows: [],
}

/** What the prototype data port answers for the platform module. */
export const PLATFORM_FIXTURES: ModuleFixtures = {
    reads: {
        "platform.installation": { ready: INSTALLATION, empty: INSTALLATION_NONE },
        "platform.agent-done": { ready: DONE_VIEW, empty: DONE_NONE },
        "platform.agent-connections": { ready: CONNECTIONS_VIEW, empty: CONNECTIONS_NONE },
        "platform.agent-knowledge": { ready: KNOWLEDGE_VIEW, empty: KNOWLEDGE_NONE },
        "platform.parked-runs": {
            ready: PARKED_RUNS_VIEW,
            readyIn: { vi: PARKED_RUNS_VIEW, en: PARKED_RUNS_VIEW_EN },
            empty: PARKED_RUNS_NONE,
        },
    },
    actions: { "platform.resume-run": { ok: true } },
}
