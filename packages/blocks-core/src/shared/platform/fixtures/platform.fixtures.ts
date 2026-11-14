import type { ConnectionsRegionView, ItemsRegionView, KnowledgeRegionView } from "../../views/views.types"
import type { ModuleFixtures } from "../../modules/module-fixtures"
import { RUN_PARKED } from "../../fixtures/run-timeline.fixtures"
import type { AgentRunCounts } from "../agent-runs"
import { deskRunRowOf } from "../agent-desk"
import type { DeskRunsPage } from "../reads/agent-runs.read"
import {
    DESK_FLOWS_NONE,
    DESK_FLOWS_VIEW,
    DESK_REACH_NONE,
    DESK_REACH_VIEW,
    DESK_TODAY_UNCOUNTED,
    DESK_TODAY_VIEW,
    DESK_WAITING_NONE,
    DESK_WAITING_VIEW,
} from "./agent-desk.fixtures"
import en from "../messages/en.json"
import vi from "../messages/vi.json"
import type { InstallationFacts, InstallationView, ParkedRunsView } from "../platform.types"
import { SALES_ORDER_ENTITY } from "../../entities/sales-entity-names"

/** An installation with one enabled module and one the workspace has not enabled. */
export const INSTALLATION: InstallationView = {
    registryHash: "8f6b9c113b15db934d20405ff96ac98a8fe24a13b5dbd99ac70af5703629d39c",
    modules: [
        {
            key: "sales",
            enabled: true,
            permissions: ["sales.view", "sales.manage"],
            reads: ["blocks-core.sales.api.lead.list"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        {
            key: "loyalty",
            enabled: false,
            permissions: ["sales.view"],
            reads: ["blocks-core.sales.api.loyalty-member.list"],
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
            reads: ["blocks-core.sales.api.lead.list"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        { key: "loyalty", permissions: ["sales.view"], reads: ["blocks-core.sales.api.loyalty-member.list"], actions: [], views: [] },
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

/** Three accounts attached to the agent: two SePay accounts (MB is the default receiving one) and a Google sheet. */
export const CONNECTIONS_VIEW: ConnectionsRegionView = {
    label: "T\u00e0i kho\u1ea3n \u0111\u00e3 g\u1eafn",
    rightsLabel: "Quy\u1ec1n",
    rightsHref: "",
    rows: [
        {
            id: "conn-mb",
            name: "SePay \u00b7 MB \u2022\u2022\u2022\u2022 5252",
            description: "\u0110\u1ecdc giao d\u1ecbch \u00b7 D\u00f2 l\u1ea1i ti\u1ec1n (T\u1ef1 \u0111\u1ed9ng)",
            provider: "sepay",
            access: "auto",
            accountMasked: "MB \u2022\u2022\u2022\u2022 5252",
            account: "MB \u2022\u2022\u2022\u2022 5252",
            isDefaultReceiving: true,
        },
        {
            id: "conn-vcb",
            name: "SePay \u00b7 VCB \u2022\u2022\u2022\u2022 0071",
            description: "\u0110\u1ecdc giao d\u1ecbch",
            provider: "sepay",
            access: "read",
            accountMasked: "VCB \u2022\u2022\u2022\u2022 0071",
            account: "VCB \u2022\u2022\u2022\u2022 0071",
        },
        {
            id: "conn-sheet",
            name: "Google \u00b7 S\u1ed5 thu NIVO",
            description: "Ghi s\u1ed5 (H\u1ecfi)",
            provider: "google",
            access: "ask",
            account: "S\u1ed5 thu NIVO",
        },
    ],
}

/** The agent has no connection. */
export const CONNECTIONS_NONE: ConnectionsRegionView = {
    label: "T\u00e0i kho\u1ea3n \u0111\u00e3 g\u1eafn",
    rightsLabel: "Quy\u1ec1n",
    rightsHref: "",
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
/** The words a parked run is drawn with: its step and its error, in one language. */
interface ParkedWords {
    /** The step of the confirm run. */
    readonly parked_step_confirm: string
    /** The step of the notify run. */
    readonly parked_step_notify: string
    /** The error of a message that could not be sent. */
    readonly parked_error_delivery_failed: string
    /** The error of a channel that did not answer. */
    readonly parked_error_timeout: string
}

const parkedRunsIn = (words: ParkedWords): ParkedRunsView => ({
    count: "2",
    rows: [
        {
            id: "run-2",
            module: "sales",
            subjectKind: SALES_ORDER_ENTITY,
            subjectId: "order-2",
            step: words.parked_step_confirm,
            errorCode: "DELIVERY_FAILED",
            errorWords: words.parked_error_delivery_failed,
            parkedAt: "2026-11-04T10:30:00.000Z",
        },
        {
            id: "run-1",
            module: "sales",
            subjectKind: SALES_ORDER_ENTITY,
            subjectId: "order-1",
            step: words.parked_step_notify,
            errorCode: "TIMEOUT",
            errorWords: words.parked_error_timeout,
            parkedAt: "2026-11-04T09:10:00.000Z",
        },
    ],
})

/** Two runs the engine parked, in the default language (Vietnamese): the words are those of the platform messages. */
export const PARKED_RUNS_VIEW: ParkedRunsView = parkedRunsIn(vi)

/** The same two parked runs in English. */
export const PARKED_RUNS_VIEW_EN: ParkedRunsView = parkedRunsIn(en)

/** No run is parked. */
export const PARKED_RUNS_NONE: ParkedRunsView = {
    count: null,
    rows: [],
}

/** The runs of an agent: one parked on a refused send, one failed, one running and one done; the desk counted records for two of them. */
export const AGENT_RUNS_VIEW: DeskRunsPage = {
    rows: [
        deskRunRowOf(
            { id: "run-3", status: "parked", trigger: "zalo.message", when: "05/11/2026 15:00", duration: "1:12" },
            {
                runId: "run-3",
                ask: "Minh An c\u00f2n d\u1ecbch v\u1ee5 n\u00e0o s\u1eafp h\u1ebft h\u1ea1n?",
                askedBy: "Ch\u1ecb Lan",
                readCount: 4,
                changedCount: 0,
                uncounted: 0,
                outcome: "stopped",
            },
            "vi",
        ),
        deskRunRowOf(
            { id: "run-4", status: "failed", trigger: "schedule.daily", when: "05/11/2026 09:00", duration: "0:04" },
            undefined,
            "vi",
        ),
        deskRunRowOf(
            { id: "run-5", status: "running", trigger: "zalo.message", when: "05/11/2026 15:20", duration: "0:09" },
            {
                runId: "run-5",
                ask: null,
                askedBy: null,
                readCount: null,
                changedCount: null,
                uncounted: 2,
                outcome: "running",
            },
            "vi",
        ),
        deskRunRowOf(
            { id: "run-1", status: "done", trigger: "zalo.message", when: "05/11/2026 08:00", duration: "1:07" },
            {
                runId: "run-1",
                ask: "Ghi l\u1ea1i email m\u1edbi c\u1ee7a anh Phong",
                askedBy: "Anh T\u00fa",
                readCount: 1,
                changedCount: 1,
                uncounted: 0,
                outcome: "changed",
            },
            "vi",
        ),
    ],
    cursor: null,
}

/** The agent has not run yet. */
export const AGENT_RUNS_NONE: DeskRunsPage = {
    rows: [],
    cursor: null,
}

/** How many runs the agent has under each filter. */
export const AGENT_RUN_COUNTS: AgentRunCounts = { counts: { running: 1, parked: 1, done: 1, failed: 1, cancelled: 0 }, total: 4 }

/** The agent has no run. */
export const AGENT_RUN_COUNTS_NONE: AgentRunCounts = { counts: { running: 0, parked: 0, done: 0, failed: 0, cancelled: 0 }, total: 0 }

/** What the prototype data port answers for the platform module. */
export const PLATFORM_FIXTURES: ModuleFixtures = {
    reads: {
        "platform.installation": { ready: INSTALLATION, empty: INSTALLATION_NONE },
        "platform.agent-done": { ready: DONE_VIEW, empty: DONE_NONE },
        "platform.agent-connections": { ready: CONNECTIONS_VIEW, empty: CONNECTIONS_NONE },
        "platform.agent-knowledge": { ready: KNOWLEDGE_VIEW, empty: KNOWLEDGE_NONE },
        "platform.installation-connections": { ready: CONNECTIONS_VIEW, empty: CONNECTIONS_NONE },
        "platform.installation-knowledge": { ready: KNOWLEDGE_VIEW, empty: KNOWLEDGE_NONE },
        "platform.parked-runs": {
            ready: PARKED_RUNS_VIEW,
            readyIn: { vi: PARKED_RUNS_VIEW, en: PARKED_RUNS_VIEW_EN },
            empty: PARKED_RUNS_NONE,
        },
        "platform.agent-runs": { ready: AGENT_RUNS_VIEW, empty: AGENT_RUNS_NONE },
        "platform.agent-run-counts": { ready: AGENT_RUN_COUNTS, empty: AGENT_RUN_COUNTS_NONE },
        "platform.agent-run": { ready: RUN_PARKED },
        "platform.agent-flows": { ready: DESK_FLOWS_VIEW, empty: DESK_FLOWS_NONE },
        "platform.waiting-on-person": { ready: DESK_WAITING_VIEW, empty: DESK_WAITING_NONE },
        "platform.agent-today": { ready: DESK_TODAY_VIEW, empty: DESK_TODAY_UNCOUNTED },
        "platform.agent-reach": { ready: DESK_REACH_VIEW, empty: DESK_REACH_NONE },
    },
    actions: {
        "platform.resume-run": { ok: true },
        "platform.approval-decide": { ok: true },
    },
}

/** The key of the approval row of the desk fixture, for a prototype that presses its verdict. */
export { DESK_APPROVAL_KEY } from "./agent-desk.fixtures"
