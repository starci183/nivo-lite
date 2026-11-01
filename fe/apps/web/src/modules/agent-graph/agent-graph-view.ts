import type {
    AgentGraphBranchForm,
    AgentGraphData,
    AgentGraphHeadView,
    AgentGraphPanelView,
    AgentGraphPhoneView,
    AgentGraphSideTab,
} from "@/modules/types"
import { BANDS, bandCentreOf, branchHitOf, flowEdgesOf, flowNodesOf } from "./agent-graph-flow"
import { detailViewOf } from "./agent-graph-view-detail"
import { editorViewOf } from "./agent-graph-view-editor"
import { branchesViewOf, proposalsViewOf, runViewOf, versionsViewOf } from "./agent-graph-view-lists"
import { kindWordOf } from "./agent-graph-words"
import type { AgentGraphContext } from "./agent-graph-words"

/** What the person is doing on the panes: the choices that are not data. */
export interface AgentGraphUi {
    readonly selectedKey: string
    readonly sideTab: AgentGraphSideTab
    readonly phoneView: AgentGraphPhoneView
    readonly isDrawerOpen: boolean
    /** The form of the branch being edited; null when none is. */
    readonly form: AgentGraphBranchForm | null
    /** The run being traced on the graph; empty when none is. */
    readonly runId: string
    readonly isPublishing: boolean
}

/** Where the graph stands, in one line: the draft or the running version, then what is left to settle. */
const statusOf = (data: AgentGraphData, ctx: AgentGraphContext): string => {
    const { t } = ctx
    const lead =
        data.changes > 0
            ? t("statusDraft", { count: data.changes })
            : t("statusVersion", { version: data.activeVersion })
    const conflicts = data.proposals.filter((proposal) => proposal.kind === "conflict").length
    const learned = data.proposals.length - conflicts
    if (data.gaps > 0) return `${lead} · ${t("statusGaps", { count: data.gaps })}`
    if (conflicts > 0) return `${lead} · ${t("statusConflicts", { count: conflicts })}`
    if (learned > 0) return `${lead} · ${t("statusLearned", { count: learned })}`
    return `${lead} · ${t("statusClear")}`
}

/** Why the draft cannot be published; empty when it can. */
const publishBlockedOf = (data: AgentGraphData, ctx: AgentGraphContext): string => {
    if (!ctx.canEdit) return ctx.t("cannotEdit")
    if (data.changes === 0) return ctx.t("nothingToPublish")
    return data.gaps > 0 ? ctx.t("gapsBlock") : ""
}

const headOf = (data: AgentGraphData, ctx: AgentGraphContext, isPublishing: boolean): AgentGraphHeadView => ({
    title: ctx.t("title"),
    status: statusOf(data, ctx),
    badges: [
        { text: ctx.t("badgeRunningN", { version: data.activeVersion }), tone: "success" },
        data.mode === "enforced"
            ? { text: ctx.t("modeEnforced"), tone: "accent" }
            : { text: ctx.t("modeShadow"), tone: "muted" },
    ],
    publishLabel: ctx.t("publish", { version: data.activeVersion + 1 }),
    publishBlocked: publishBlockedOf(data, ctx),
    isPublishing,
})

/**
 * Every word the graph panes draw, from the graph and what the person is doing: the head, the cards painted by selection or by a
 * traced run, the detail of the selected node, the form of a branch, the proposals, the history and the phone list.
 */
export const panelViewOf = (data: AgentGraphData, ui: AgentGraphUi, ctx: AgentGraphContext): AgentGraphPanelView => {
    const { t } = ctx
    const run = data.runs.find((entry) => entry.id === ui.runId) ?? null
    const editor =
        ui.form === null || branchHitOf(data.nodes, ui.selectedKey) === null
            ? null
            : editorViewOf(data, { nodeKey: ui.selectedKey, form: ui.form }, ctx)
    const proposals = data.proposals.length
    const inspector = (() => {
        if (editor !== null) return "editor"
        return run === null ? "detail" : "run"
    })()
    return {
        head: headOf(data, ctx, ui.isPublishing),
        canvas: {
            label: t("mapLabel"),
            emptyLabel: t("mapEmpty"),
            nodes: flowNodesOf(data.nodes, { selectedKey: ui.selectedKey, path: run?.path ?? [] }),
            edges: flowEdgesOf(data.nodes, {
                approved: t("edgeApproved"),
                taken: (label) => t("edgeTaken", { label }),
                isTaken: (source, target) => {
                    const at = run?.path.indexOf(source) ?? -1
                    return at >= 0 && run?.path[at + 1] === target
                },
            }),
            headers: BANDS.map((kind) => ({ label: kindWordOf(t, kind), at: bandCentreOf(kind) })),
            selectedId: ui.selectedKey,
        },
        sideTab: ui.sideTab,
        tabsLabel: t("tabsLabel"),
        tabs: [
            { value: "chat", label: t("tabChat") },
            { value: "detail", label: t("tabDetail") },
            {
                value: "proposals",
                label: proposals === 0 ? t("tabProposals") : t("tabProposalsN", { count: proposals }),
            },
            { value: "versions", label: t("tabVersions") },
        ],
        phoneView: ui.phoneView,
        phoneLabel: t("phoneLabel"),
        phoneOptions: [
            { value: "branches", label: t("phoneBranches") },
            { value: "graph", label: t("phoneGraph") },
            { value: "chat", label: t("tabChat") },
            {
                value: "proposals",
                label: proposals === 0 ? t("tabProposals") : t("tabProposalsN", { count: proposals }),
            },
            { value: "versions", label: t("tabVersions") },
        ],
        inspector,
        detail: detailViewOf(data, ui.selectedKey, ctx),
        editor,
        run: run === null ? null : runViewOf(run, ctx),
        proposals: proposalsViewOf(data, ctx),
        versions: versionsViewOf(data, ctx),
        branches: branchesViewOf(data, ctx),
        drawerTitle: t("detailTitle"),
        isDrawerOpen: ui.isDrawerOpen,
    }
}
