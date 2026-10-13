"use client"

import { useMemo } from "react"
import { agentOptionOf, connectionsOf } from "@/hooks/connection-wire"
import { useQueryConnectionAgentsSwr, useQueryConnectionsSwr } from "@/hooks/swr"

/** The connections of the workspace and its agents, read from the back end GraphQL API through SWR and mapped for the console. */
export const useConnectionsData = () => {
    const connectionsQuery = useQueryConnectionsSwr()
    const agentsQuery = useQueryConnectionAgentsSwr()
    const items = useMemo(() => connectionsOf(connectionsQuery.data ?? []), [connectionsQuery.data])
    const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data])
    const active = useMemo(() => agents.filter((agent) => agent.status === "active").map(agentOptionOf), [agents])
    return {
        items,
        agentNames: Object.fromEntries(agents.map((agent) => [agent.id, agent.name])),
        activeAgents: active,
        isLoading: connectionsQuery.isLoading || agentsQuery.isLoading,
        failed: connectionsQuery.error !== undefined || agentsQuery.error !== undefined,
    }
}
