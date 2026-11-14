"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { bindableOf, useBindableAgents } from "@/hooks/bindable-agents"
import { useConnectionsData, useConnectionsRole, useSetConnectionGrant } from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import type { ConnectionGrantsView, DataSlot } from "@/modules/types"

/** What the agents-of-a-connection section reads and the commands behind it. */
interface ConnectionGrantsRead {
    readonly slot: DataSlot<ConnectionGrantsView>
    /** Unbinds an agent from this connection. */
    readonly remove: (agentId: string) => void
    /** Binds an agent to this connection. */
    readonly assign: (agentId: string) => void
    readonly retry: () => void
}

/**
 * The agents bound to one connection and the agents that could be. A binding has no level (what an agent may do through the account
 * is ticked on its rights tab): every command here is one `setConnectionGrant`, bind or unbind. Only the owner binds; the back end
 * refuses everyone else.
 */
export const useConnectionGrants = (connectionId: string): ConnectionGrantsRead => {
    const t = useTranslations("connections")
    const data = useConnectionsData()
    const access = useConnectionsRole()
    const setGrant = useSetConnectionGrant()
    const connection = data.items.find((item) => item.id === connectionId)
    // Who may be bound comes from the back end; until it answers the slot loads, so no pair is guessed.
    const bindable = useBindableAgents(connection?.provider)
    const bound = new Set(connection?.agentIds ?? [])
    const view: ConnectionGrantsView = {
        canManage: access.role === "owner",
        removeLabel: t("grantRemove"),
        rows: [...bound].map((agentId) => ({ id: agentId, name: data.agentNames[agentId] ?? agentId })),
        candidates: bindableOf(
            data.activeAgents.filter((agent) => !bound.has(agent.id)),
            bindable.data ?? [],
        ).map((agent) => ({ id: agent.id, label: agent.name })),
    }
    const slot = slotOfReads([access.read, ...data.reads, bindable], () => (connection === undefined ? undefined : view))
    const remove = useCallback(
        (agentId: string): void => void setGrant(connectionId, agentId, false),
        [connectionId, setGrant],
    )
    const assign = useCallback(
        (agentId: string): void => void setGrant(connectionId, agentId, true),
        [connectionId, setGrant],
    )
    return {
        slot,
        remove,
        assign,
        retry: () => {
            access.retry()
            data.retry()
            void bindable.mutate()
        },
    }
}
