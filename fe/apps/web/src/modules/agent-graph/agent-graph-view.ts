import type {
    AgentGraphData,
    AgentGraphDecideForm,
    AgentGraphHeadView,
    AgentGraphPanelView,
    AgentGraphPhoneView,
    AgentGraphSideTab,
} from "@/modules/types"
import { cardLineWithChannels } from "./agent-graph-channels"
import { flowEdgesOf, flowNodesOf, layerHeadersOf } from "./agent-graph-flow"
import { problemLinesOf } from "./agent-graph-problems"
import { detailViewOf } from "./agent-graph-view-detail"
import { adderPickOf, adderViewOf, decideEditorViewOf, problemsViewOf } from "./agent-graph-view-decide"
import type { AgentGraphAdderPick } from "./agent-graph-view-decide"
import { branchesViewOf, modeViewOf, proposalsViewOf, runViewOf, versionsViewOf } from "./agent-graph-view-lists"
import { kindWordOf } from "./agent-graph-words"
import type { AgentGraphContext } from "./agent-graph-words"

/** What the person is doing on the panes: the choices that are not data. */
export interface AgentGraphUi {
    readonly selectedKey: string
    readonly sideTab: AgentGraphSideTab
    readonly phoneView: AgentGraphPhoneView
    readonly isDrawerOpen: boolean
    /** The decision point being edited; null when none is. */
    readonly form: AgentGraphDecideForm | null
    /** The form as it was when the owner opened it, to tell whether anything changed. */
    readonly formStart: AgentGraphDecideForm | null
    /** The action and the fact the owner picked to add a decision point on. */
    readonly adder: AgentGraphAdderPick
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
    if (data.problems.length > 0) return `${lead} · ${t("statusProblems", { count: data.problems.length })}`
    if (data.gaps.length > 0) return `${lead} · ${t("statusGaps", { count: data.gaps.length })}`
    if (conflicts > 0) return `${lead} · ${t("statusConflicts", { count: conflicts })}`
    if (learned > 0) return `${lead} · ${t("statusLearned", { count: learned })}`
    if (ctx.setup.isReady && ctx.setup.isChanged) return `${lead} · ${t("statusSetupChanged")}`
    if (!ctx.setup.isReady) return `${lead} · ${t("statusSetupMissing", { count: ctx.setup.missing })}`
    return `${lead} · ${t("statusClear")}`
}

/** Why the draft cannot be published, in words: what is wrong first; empty when it can be. */
const publishBlockedOf = (data: AgentGraphData, ctx: AgentGraphContext): string => {
    if (!ctx.canEdit) return ctx.t("cannotEdit")
    const first = problemLinesOf(data, ctx.t)[0]
    if (first !== undefined) return ctx.t("problemsBlock", { count: data.problems.length, first: first.text })
    if (data.gaps.length > 0) return ctx.t("gapsBlock")
    if (data.changes > 0 || (ctx.setup.isReady && ctx.setup.isChanged)) return ""
    return ctx.setup.isReady ? ctx.t("nothingToPublish") : ctx.t("setupMissingBlock", { count: ctx.setup.missing })
}

const headOf = (data: AgentGraphData, ctx: AgentGraphContext, isPublishing: boolean): AgentGraphHeadView => ({
    title: ctx.t("title"),
    status: statusOf(data, ctx),
    badges: [],
    publishLabel: ctx.t("publish", { version: data.activeVersion + 1 }),
    publishBlocked: publishBlockedOf(data, ctx),
    isPublishing: isPublishing || ctx.setup.isApplying,
})

/**
 * Every word the graph panes draw, from the graph and what the person is doing: the head, the cards painted by selection or by a
 * traced run, the detail of the selected node, the form of a decision point, the problems, the proposals, the history and the phone
 * list.
 */
export const panelViewOf = (data: AgentGraphData, ui: AgentGraphUi, ctx: AgentGraphContext): AgentGraphPanelView => {
    const { t } = ctx
    const run = data.runs.find((entry) => entry.id === ui.runId) ?? null
    const editor = ui.form === null ? null : decideEditorViewOf(data, ui.form, ui.formStart, ctx)
    const proposals = data.proposals.length
    const inspector = (() => {
        if (editor !== null) return "editor"
        return run === null ? "detail" : "run"
    })()
    return {
        head: headOf(data, ctx, ui.isPublishing),
        mode: modeViewOf(data, ctx),
        canvas: {
            label: t("mapLabel"),
            emptyLabel: t("mapEmpty"),
            nodes: flowNodesOf(data.nodes, { selectedKey: ui.selectedKey, path: run?.path ?? [] }).map((flow) => {
                const node = data.nodes.find((entry) => entry.key === flow.id)
                return node === undefined
                    ? flow
                    : {
                          ...flow,
                          description: cardLineWithChannels(node, {
                              connected: ctx.channels,
                              none: t("channelNone"),
                          }),
                      }
            }),
            edges: flowEdgesOf(data.nodes, {
                approved: t("edgeApproved"),
                taken: (label) => t("edgeTaken", { label }),
                isTaken: (source, target) => {
                    const at = run?.path.indexOf(source) ?? -1
                    return at >= 0 && run?.path[at + 1] === target
                },
            }),
            headers: layerHeadersOf(data.nodes, (kind) => kindWordOf(t, kind)),
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
        problems: problemsViewOf(data, ctx),
        adder: adderViewOf(data, adderPickOf(data, ui.adder), ctx),
        run: run === null ? null : runViewOf(run, ctx),
        proposals: proposalsViewOf(data, ctx),
        versions: versionsViewOf(data, ctx),
        branches: branchesViewOf(data, ctx),
        drawerTitle: t("detailTitle"),
        isDrawerOpen: ui.isDrawerOpen,
    }
}
