"use client"

import { useCallback } from "react"
import { purposeFor } from "@/hooks/connection-access"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryConnectionAgentsSwr } from "@/hooks/swr"
import type { ConnectionAgentRowView, DataSlot, Provider } from "@/modules/types"
import { useConnectionsRole } from "./useConnectionsRole"
import { useSetConnectionAgents } from "./useSetConnectionAgents"

/** The part of a connection page the agent rows read: the agents on the connection, the state of that read, and how to read it again. */
interface ConnectionPageRead {
    readonly slot: DataSlot<{ readonly agentIds: ReadonlyArray<string> }>
    readonly reload: () => void
}

/**
 * The agents that can work through a connection of a provider (a grant of that pair has a purpose), each marked when it does, and the
 * toggle that saves the set; only the owner may toggle, since the back end refuses everyone else.
 */
export const useConnectionAgentRows = (connectionId: string, provider: Provider, page: ConnectionPageRead) => {
    const agentIds = page.slot.items?.agentIds
    const { reload } = page
    const agentsRead = useQueryConnectionAgentsSwr()
    const setAgents = useSetConnectionAgents()
    const { role } = useConnectionsRole()
    const agents = slotOfSwr(agentsRead)
    const on = new Set(agentIds ?? [])
    const slot: DataSlot<ReadonlyArray<ConnectionAgentRowView>> = {
        isLoading: agents.isLoading === true || page.slot.isLoading === true,
        isForbidden: agents.isForbidden,
        isError: agents.isError === true || page.slot.isError === true,
        items:
            agents.items === undefined || agentIds === undefined
                ? undefined
                : agents.items
                      .filter(
                          (agent) =>
                              on.has(agent.id) ||
                              (agent.status === "active" && purposeFor(agent.module, provider) !== null),
                      )
                      .map((agent) => ({ id: agent.id, name: agent.name, isOn: on.has(agent.id) })),
    }
    const toggle = useCallback(
        async (agentId: string, isOn: boolean): Promise<void> => {
            const wanted = new Set(agentIds ?? [])
            if (isOn) wanted.add(agentId)
            else wanted.delete(agentId)
            await setAgents(connectionId, [...wanted])
            reload()
        },
        [agentIds, setAgents, connectionId, reload],
    )
    return { slot, toggle, reload, isOwner: role === "owner" }
}
