"use client"

import { useQueryAuthUserSwr } from "@/hooks/auth"
import {
    isLocalOnly,
    useConnectionRowView,
    useConnectionsData,
    useConnectionsRole,
    type ConnectionRowHandlers,
} from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import { webSiteOrigin } from "@/modules/config"
import type { Connection, DataSlot, RowView } from "@/modules/types"

/** A connection with nothing in it: the hook runs for it while the workspace reads wait, so the placeholder view has the ready shape. */
const BLANK: Connection = {
    id: "",
    workspaceId: "",
    provider: "smtp",
    name: "",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    agentIds: [],
    grants: [],
}

/** What the detail pane of a connection without a page of its own reads. */
interface ConnectionOpenRead {
    readonly slot: DataSlot<RowView>
    /** The view drawn while the read waits: same shape, no words. */
    readonly placeholder: RowView
    readonly on: ConnectionRowHandlers
    readonly retry: () => void
}

/**
 * The detail of one connection that has no page of its own (outgoing email, a webhook, Google Sheets, a data source): the same view
 * and commands its row has in a drawer, for the pane beside the list.
 */
export const useConnectionOpen = (connectionId: string): ConnectionOpenRead => {
    const data = useConnectionsData()
    const access = useConnectionsRole()
    const user = useQueryAuthUserSwr()
    const found = data.items.find((item) => item.id === connectionId)
    const { view, on } = useConnectionRowView({
        connection: found ?? BLANK,
        agentNames: (found?.agentIds ?? [])
            .map((id) => data.agentNames[id])
            .filter((name): name is string => name !== undefined),
        localOnly: isLocalOnly(webSiteOrigin()),
        ownerEmail: user.data?.email ?? "",
        agents: data.activeAgents,
        canManage: access.role === "owner",
    })
    const readSlot = slotOfReads([access.read, ...data.reads], () => (found === undefined ? undefined : view))
    return {
        slot: readSlot,
        placeholder: view,
        on,
        retry: () => {
            access.retry()
            data.retry()
        },
    }
}
