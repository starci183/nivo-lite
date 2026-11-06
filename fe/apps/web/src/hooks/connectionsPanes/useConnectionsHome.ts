"use client"

import { useTranslations } from "next-intl"
import { attentionConnections, boardSlotOf, useConnectionsData, useConnectionsRole } from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import type { Connection, ConnectionsOverviewView, DataSlot } from "@/modules/types"
import { agentRowsOf, nextStepOf } from "./connectionsPanes.shared"

/** What the overview pane reads. */
interface ConnectionsHomeRead {
    readonly slot: DataSlot<ConnectionsOverviewView>
    readonly retry: () => void
}

/**
 * The overview of the Connections page: how many connections run and how many need the owner, the one that needs the owner next, and
 * which agents work through which connection.
 */
export const useConnectionsHome = (): ConnectionsHomeRead => {
    const t = useTranslations("connections")
    const data = useConnectionsData()
    const access = useConnectionsRole()
    const workspaces = useWorkspaceCards()
    const { activeWorkspaceId } = useActiveWorkspace()
    const manager = access.role === "owner" || access.role === "manager"
    const canManage = access.role === "owner"
    const attention = attentionConnections(data.items)
    const first = attention[0]
    const namesOf = (connection: Connection) =>
        connection.agentIds.map((id) => data.agentNames[id]).filter((name): name is string => name !== undefined)
    const agents = agentRowsOf(data.items, data.agentNames)
    const workspace = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.name ?? ""
    const view: ConnectionsOverviewView = {
        head: t("overviewHead", { workspace, count: data.items.length }),
        agentsMeta: t("figureAgentsMeta", { count: data.activeAgents.length }),
        workspace,
        count: data.items.length,
        live: data.items.filter((connection) => connection.status === "connected").length,
        attention: attention.length,
        agentCount: agents.length,
        activeAgents: data.activeAgents.length,
        next:
            first === undefined
                ? null
                : nextStepOf(first, namesOf(first), canManage, t, t("continueSetup"), activeWorkspaceId ?? ""),
        agents,
        canManage,
    }
    const readSlot = slotOfReads([access.read, workspaces.read, ...data.reads], () => view)
    const gated =
        "items" in readSlot
            ? boardSlotOf({ isLoading: false, isManager: manager, isFailed: false }, readSlot.items)
            : readSlot
    const slot: DataSlot<ConnectionsOverviewView> =
        "items" in gated && gated.items.count === 0 ? { isEmpty: true } : gated
    return {
        slot,
        retry: () => {
            access.retry()
            data.retry()
        },
    }
}
