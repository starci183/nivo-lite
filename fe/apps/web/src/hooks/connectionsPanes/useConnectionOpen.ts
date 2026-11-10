"use client"

import { useTranslations } from "next-intl"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import { usesAgents } from "@/hooks/connection-rows"
import { isLocalOnly, useConnectionRowView, useConnectionsData, useConnectionsRole } from "@/hooks/connections"
import type { ConnectionRowHandlers } from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import { webSiteOrigin } from "@/modules/config"
import { lifecycleChipOf, lifecycleOf } from "@/modules/connection-lifecycle"
import type { Connection, ConnectionLifecycleChip, DataSlot, Provider, RowView } from "@/modules/types"
import { useConnectionOpenFacts } from "./useConnectionOpenFacts"
import type { ConnectionOpenEvent, ConnectionOpenFact } from "./useConnectionOpenFacts"

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
}

/** What the page of a connection without a page of its own reads. */
export interface ConnectionOpenRead {
    readonly slot: DataSlot<RowView>
    /** The view drawn while the read waits: same shape, no words. */
    readonly placeholder: RowView
    readonly on: ConnectionRowHandlers
    readonly retry: () => void
    /** The status badge in the one vocabulary of the Connections screens; null while the connection is read. */
    readonly chip: ConnectionLifecycleChip | null
    /** The details card's rows. */
    readonly facts: ReadonlyArray<ConnectionOpenFact>
    /** The latest event the connection reported, when it did. */
    readonly event: ConnectionOpenEvent | null
    /** Whether an agent can work through this provider (the agents tab and band exist only for those). */
    readonly hasAgents: boolean
    /** How many agents work through the connection; undefined while it is read. */
    readonly agentCount: number | undefined
    /** The tile glyph shown when the provider has no mark of its own. */
    readonly glyph: "email" | "apps"
    /** The connections are read and none has this id. */
    readonly isMissing: boolean
    /** The connection's provider, for the middle step of the trail; undefined while it is read. */
    readonly provider: Provider | undefined
}

/**
 * The page of one connection that has no page of its own (outgoing email, a webhook, Google Sheets, a data source): the same view
 * and commands its row has in a drawer, the status in the shared vocabulary, the details card and the latest event it reported.
 */
export const useConnectionOpen = (connectionId: string): ConnectionOpenRead => {
    const t = useTranslations("connections")
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
        canManage: access.role === "owner",
    })
    const { facts, event } = useConnectionOpenFacts(found, view)
    const readSlot = slotOfReads([access.read, ...data.reads], () => (found === undefined ? undefined : view))
    return {
        slot: readSlot,
        placeholder: view,
        on,
        retry: () => {
            access.retry()
            data.retry()
        },
        chip: found === undefined ? null : lifecycleChipOf(lifecycleOf(found), (key, values) => t(key, values)),
        facts,
        event,
        hasAgents: found !== undefined && usesAgents(found.provider),
        agentCount: found === undefined ? undefined : found.agentIds.length,
        glyph: found?.provider === "smtp" ? "email" : "apps",
        isMissing: found === undefined && "items" in data.slot,
        provider: found?.provider,
    }
}
