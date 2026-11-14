"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useBankName } from "@/hooks/banks"
import {
    attentionConnections,
    boardSlotOf,
    sortRows,
    URL_PARAMS,
    useConnectionsData,
    useConnectionsRole,
} from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import { lifecycleOf } from "@/modules/connection-lifecycle"
import type { Connection, ConnectionsFigures, ConnectionsListView, DataSlot } from "@/modules/types"
import { filtersOf, listRowOf, nextStepOf } from "./connectionsPanes.shared"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The health figures: what runs, what waits, what needs the owner, and how many agents work through a connection. */
const figuresOf = (connections: ReadonlyArray<Connection>, agentsTotal: number): ConnectionsFigures => {
    const live = connections.filter((connection) => connection.status !== "disconnected")
    const lives = live.map((connection) => lifecycleOf(connection))
    return {
        total: live.length,
        running: lives.filter((life) => life.id === "running").length,
        waiting: lives.filter((life) => life.id === "waiting" || life.id === "setup").length,
        // One definition with the "Needs you" list and the filter: a failure and an unfinished setup both need the owner.
        attention: lives.filter((life) => life.id === "attention" || life.id === "setup" || life.id === "waiting")
            .length,
        agentsUsing: new Set(live.flatMap((connection) => connection.agentIds)).size,
        agentsTotal,
    }
}

/** The tab the page shows: the library only when the address asks for it. */
type ConnectionsTab = "connected" | "library"

/** What the Connections page reads: the slot of the list, the tab and the retry. */
interface ConnectionsListRead {
    readonly slot: DataSlot<ConnectionsListView>
    readonly tab: ConnectionsTab
    readonly retry: () => void
}

/**
 * The Connections page: every connection, the ones that need the owner (failures first) with their one action, the health figures,
 * the filter row and the summary line; and the tab the address opens. A staff member reads nothing: the slot is forbidden.
 */
export const useConnectionsList = (): ConnectionsListRead => {
    const t = useTranslations("connections")
    const bankName = useBankName()
    const workspaceId = useWorkspaceId()
    const params = useSearchParams()
    const access = useConnectionsRole()
    const data = useConnectionsData()
    const manager = access.role === "owner" || access.role === "manager"
    const canManage = access.role === "owner"
    const attention = [...attentionConnections(data.items)].sort(
        (a, b) => Number(b.status === "error") - Number(a.status === "error"),
    )
    const rows = sortRows(data.items).map((connection) =>
        listRowOf(connection, t, bankName, workspaceId, data.agentNames),
    )
    const namesOf = (connection: Connection) =>
        connection.agentIds.map((id) => data.agentNames[id]).filter((name): name is string => name !== undefined)
    const figures = figuresOf(data.items, data.activeAgents.length)
    const view: ConnectionsListView = {
        rows,
        filters: filtersOf(rows, (id) => t(`filter_${id}`)),
        summary: t("summaryLife", {
            running: figures.running,
            waiting: figures.waiting,
            attention: figures.attention,
        }),
        liveCount: rows.length,
        attention: attention.map((connection) =>
            nextStepOf(connection, namesOf(connection), canManage, t, workspaceId),
        ),
        figures,
        canManage,
    }
    const readSlot = slotOfReads([access.read, ...data.reads], () => view)
    const slot =
        "items" in readSlot
            ? boardSlotOf({ isLoading: false, isManager: manager, isFailed: false }, readSlot.items)
            : readSlot
    return {
        slot,
        tab: params.get(URL_PARAMS.tab) === "library" ? "library" : "connected",
        retry: () => {
            access.retry()
            data.retry()
        },
    }
}
