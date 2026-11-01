"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentRights } from "@/hooks/agentSettings"
import { mapSlot } from "@/hooks/slot"
import {
    AGENT_GRAPH_PLACEHOLDER,
    mediumAreasOf,
    mediumRowsOf,
    panelViewOf,
    phoneAreasOf,
    phoneRowsOf,
} from "@/modules/agent-graph"
import type { AgentGraphAction, AgentGraphPanelView } from "@/modules/types"
import { performAgentGraphAction } from "./agentGraph.shared"
import { useAgentGraphCommands } from "./useAgentGraphCommands"
import { useAgentGraphRead } from "./useAgentGraphRead"
import { useAgentGraphUi } from "./useAgentGraphUi"
import { useAgentGraphWords } from "./useAgentGraphWords"
import { useAgentGraphWrites } from "./useAgentGraphWrites"

/**
 * The graph panes of the Setup tab as one view with its commands: the map and its cards painted by selection or by a traced run,
 * the seven answers of the selected node, the editor of a decision point, the problems, the proposals and the history. Words are
 * resolved here; the person may edit when they are an owner or manager, and only the owner adds what widens the reach of the agent.
 */
export const useAgentGraphPanel = (installationId: string) => {
    const t = useTranslations("agentGraph")
    const { canEdit, canGrant } = useAgentRights()
    const [changes, setChanges] = useState(0)
    const graph = useAgentGraphRead(installationId, changes)
    const writes = useAgentGraphWrites((isDraftEmpty) => setChanges((count) => (isDraftEmpty ? 0 : count + 1)))
    const state = useAgentGraphUi(graph.runId)
    const words = useAgentGraphWords(t)
    const commands = useAgentGraphCommands({ read: graph.read, state, writes, canGrant, changes })
    const ctx = { t, canEdit, isOwner: canGrant, amount: words.amount }
    const phoneAreas = phoneAreasOf(state.ui.phoneView, state.ui.sideTab)
    return {
        props: {
            graph: mapSlot(graph.slot, (data): AgentGraphPanelView => panelViewOf(data, state.ui, ctx)),
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
