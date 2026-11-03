"use client"

import { useMemo } from "react"
import { agentOptionOf, connectionsOf } from "@/hooks/connection-wire"
import { useQueryConnectionAgentsSwr, useQueryConnectionsSwr } from "@/hooks/swr"
import { slotOfReads } from "@/hooks/slot"

/** The connections of the workspace and its agents, read from the back end GraphQL API through SWR and mapped for the console. */
export const useConnectionsData = () => {
    const connectionsQuery = useQueryConnectionsSwr()
    const agentsQuery = useQueryConnectionAgentsSwr()
    const connectionRows = connectionsQuery.data
    const agentRows = agentsQuery.data
    const items = useMemo(() => (connectionRows === undefined ? [] : connectionsOf(connectionRows)), [connectionRows])
    const active = useMemo(
        () =>
            agentRows === undefined ? [] : agentRows.filter((agent) => agent.status === "active").map(agentOptionOf),
        [agentRows],
    )
    const agentNames = useMemo(
        () => Object.fromEntries((agentRows === undefined ? [] : agentRows).map((agent) => [agent.id, agent.name])),
        [agentRows],
    )
    return {
        items,
        agentNames,
        activeAgents: active,
        slot: slotOfReads([connectionsQuery, agentsQuery], () => ({ items, agentNames, activeAgents: active })),
        /** A role-aware frame joins these authoritative reads with its access read. */
        reads: [connectionsQuery, agentsQuery],
        retry: () => {
            void connectionsQuery.mutate()
            void agentsQuery.mutate()
        },
    }
}
