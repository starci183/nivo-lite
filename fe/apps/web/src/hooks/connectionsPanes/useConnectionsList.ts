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
import { navigation } from "@/modules/i18n"
import type { Connection, ConnectionsListView, DataSlot } from "@/modules/types"
import { connectionIdOfPath } from "@/hooks/connectionsRoute"
import { filtersOf, listRowOf, nextStepOf } from "./connectionsPanes.shared"
import { useWorkspaceId } from "@/hooks/workspaces"
import { pathInWorkspace } from "@/modules/routes"

/** The tab the page shows: the library only when the address asks for it. */
type ConnectionsTab = "connected" | "library"

/** What the Connections frame reads: the slot of the list, the tab, the open connection and the retry. */
interface ConnectionsListRead {
    readonly slot: DataSlot<ConnectionsListView>
    readonly tab: ConnectionsTab
    /** The connection whose page or detail is open, if any. */
    readonly openId: string | null
    /** Its name, for the last step of the trail. */
    readonly openName: string | null
    /** The path is the Connections root: a phone shows the list there, the open connection elsewhere. */
    readonly isRoot: boolean
    readonly retry: () => void
}

/** The path of the Connections root. */
const ROOT = "/connections"

/**
 * The list pane of the Connections page: every live connection, the ones that need the owner first, the filter row, and the
 * summary line; and where the reader is (the tab, the open connection). A staff member reads nothing: the slot is forbidden.
 */
export const useConnectionsList = (): ConnectionsListRead => {
    const t = useTranslations("connections")
    const bankName = useBankName()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const path = pathInWorkspace(pathname)
    const params = useSearchParams()
    const access = useConnectionsRole()
    const data = useConnectionsData()
    const manager = access.role === "owner" || access.role === "manager"
    const attention = attentionConnections(data.items)
    const running = data.items.filter((connection) => connection.status === "connected")
    const rows = sortRows(data.items).map((connection) => listRowOf(connection, t, bankName, workspaceId))
    const first = attention[0]
    const namesOf = (connection: Connection) =>
        connection.agentIds.map((id) => data.agentNames[id]).filter((name): name is string => name !== undefined)
    const view: ConnectionsListView = {
        rows,
        filters: filtersOf(rows, (id) => t(`filter_${id}`)),
        summary:
            attention.length > 0
                ? t("summary", { live: running.length, attention: attention.length })
                : t("summaryCalm", { live: running.length }),
        liveCount: rows.length,
        attention:
            first === undefined
                ? null
                : nextStepOf(first, namesOf(first), access.role === "owner", t, t("continueSetup"), workspaceId),
    }
    const readSlot = slotOfReads([access.read, ...data.reads], () => view)
    const slot =
        "items" in readSlot
            ? boardSlotOf({ isLoading: false, isManager: manager, isFailed: false }, readSlot.items)
            : readSlot
    const asked = params.get(URL_PARAMS.open)
    const openId = connectionIdOfPath(path, data.items) ?? (data.items.some((item) => item.id === asked) ? asked : null)
    const open = openId === null ? undefined : data.items.find((item) => item.id === openId)
    return {
        slot,
        tab: params.get(URL_PARAMS.tab) === "library" ? "library" : "connected",
        openId,
        openName: open?.name ?? null,
        isRoot: path === ROOT && openId === null,
        retry: () => {
            access.retry()
            data.retry()
        },
    }
}
