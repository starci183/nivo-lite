"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useAgentWorkflowGraphView, type WorkflowGraphView } from "@/hooks/agentWorkflowGraph"
import { useSlotLabels } from "@/hooks/slot"
import { AgentWorkflowGraphBase } from "./component"

/** The agent whose graph this is. */
interface AgentWorkflowGraphProps {
    readonly module?: string | undefined
    readonly installationId?: string | undefined
}

const EMPTY: WorkflowGraphView = { nodes: [], edges: [], total: 0, running: 0, off: 0 }

/**
 * The Graph tab of an agent: its workflows on one canvas. Each workflow is a block (inputs, name, outcomes); a call from an outcome is
 * an edge to the workflow it starts; a workflow of another agent is a dashed block that opens that agent's Graph; workflows that
 * call and are called by nothing stand as islands.
 */
export const AgentWorkflowGraph = (props: AgentWorkflowGraphProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentGraphTab")
    const labels = useSlotLabels()
    const graph = useAgentWorkflowGraphView(route.module, route.installationId)
    const view = "items" in graph.slot ? graph.slot.items : EMPTY
    return (
        <AgentWorkflowGraphBase
            props={{
                gridLabel: t("gridLabel"),
                canvasLabel: t("canvasLabel"),
                title: t("title", { name: graph.agentLabel }),
                countLabel: t("count", { count: view.total }),
                statesLabel: "items" in graph.slot ? t("states", { running: view.running, off: view.off }) : "",
                openListLabel: t("openList"),
                listHref: graph.listHref,
                emptyLabel: t("empty"),
                legend: t("legend"),
                placeholder: EMPTY,
                slot: graph.slot,
                labels: labels(t("title", { name: "" })),
                isLoading: "isLoading" in graph.slot,
                positions: graph.positions,
            }}
            on={{ retry: graph.retry, move: graph.savePositions }}
        />
    )
}
