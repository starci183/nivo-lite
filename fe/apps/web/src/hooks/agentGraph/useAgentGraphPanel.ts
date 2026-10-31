"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentRights } from "@/hooks/agentSettings"
import { mapSlot } from "@/hooks/slot"
import {
    AGENT_GRAPH_PLACEHOLDER,
    branchFormOf,
    branchHitOf,
    mediumAreasOf,
    mediumRowsOf,
    panelViewOf,
    phoneAreasOf,
    phoneRowsOf,
    withField,
} from "@/modules/agent-graph"
import type { AgentGraphAction, AgentGraphCommands, AgentGraphPanelView } from "@/modules/types"
import { performAgentGraphAction } from "./agentGraph.shared"
import { useAgentGraphRead } from "./useAgentGraphRead"
import { useAgentGraphUi } from "./useAgentGraphUi"
import { useAgentGraphWrites } from "./useAgentGraphWrites"

/**
 * The graph panes of the Setup tab as one view with its commands: the map and its cards painted by selection or by a traced run,
 * the seven answers of the selected node, the form of a branch, the proposals and the history. Words are resolved here; the person
 * may edit when they are an owner or manager, and only the owner adds what widens the agent's reach.
 */
export const useAgentGraphPanel = (installationId: string) => {
    const t = useTranslations("agentGraph")
    const format = useFormatter()
    const { canEdit, canGrant } = useAgentRights()
    const [changes, setChanges] = useState(0)
    const graph = useAgentGraphRead(installationId, changes)
    const writes = useAgentGraphWrites((isDraftEmpty) => setChanges((count) => (isDraftEmpty ? 0 : count + 1)))
    const state = useAgentGraphUi()
    const ctx = { t, canEdit, isOwner: canGrant, number: (value: number) => format.number(value) }
    const data = graph.read?.data ?? AGENT_GRAPH_PLACEHOLDER
    const hit = branchHitOf(data.nodes, state.ui.selectedKey)
    const view = panelViewOf(data, state.ui, ctx)
    const phoneAreas = phoneAreasOf(state.ui.phoneView, state.ui.sideTab)
    const { read } = graph
    const commands: AgentGraphCommands = {
        select: state.select,
        sideTab: state.sideTab,
        phoneView: state.phoneView,
        openNode: state.openNode,
        closeDrawer: state.closeDrawer,
        untrace: state.untrace,
        edit: () => state.setForm(hit === null ? null : branchFormOf(hit.branch)),
        field: (name, value) => state.setForm((form) => (form === null ? null : withField(form, name, value))),
        save: () => {
            const form = state.ui.form
            if (read === undefined || hit === null || form === null) return
            void writes.saveBranch(read, { nodeKey: hit.parent.key, branchKey: hit.branch.key, form })
            state.setForm(null)
        },
        cancel: () => state.setForm(null),
        publish: () => {
            if (read !== undefined) void writes.publish(read.agentId, t("publishNote", { count: changes }))
        },
        decide: (proposalId, isConfirmed) => {
            if (read !== undefined && !isConfirmed) void writes.decline(read.agentId, proposalId)
        },
        restore: (versionId) => {
            if (read !== undefined) void writes.restore(read.agentId, versionId)
        },
        trace: () => state.trace(data.runs[0]?.id ?? ""),
    }
    return {
        props: {
            graph: mapSlot(graph.slot, (): AgentGraphPanelView => view),
            graphPlaceholder: panelViewOf(AGENT_GRAPH_PLACEHOLDER, state.ui, ctx),
            sideTab: state.ui.sideTab,
            phoneView: state.ui.phoneView,
            layout: {
                phoneAreas,
                phoneRows: phoneRowsOf(phoneAreas),
                mediumAreas: mediumAreasOf(state.ui.sideTab),
                mediumRows: mediumRowsOf(state.ui.sideTab),
            },
        },
        on: {
            retryGraph: graph.reload,
            graph: (action: AgentGraphAction) => performAgentGraphAction(commands, action),
        },
    }
}
