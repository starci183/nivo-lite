"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useBankName } from "@/hooks/banks"
import { providerKey, PROVIDER_LOGO } from "@/hooks/connection-providers"
import { boardSlotOf, useConnectionsData, useConnectionsRole } from "@/hooks/connections"
import { useQueryConnectionAgentGrantsSwr } from "@/hooks/swr"
import { slotOfReads } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { unitOfProvider } from "@/modules/connection-groups"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { ConnectionProviderHead, ConnectionProviderView, DataSlot } from "@/modules/types"
import {
    aboutOf,
    agentUsesOf,
    connectionsOfPage,
    figuresOf,
    latestEventOf,
    metaOf,
    providerAddHref,
    providerRowOf,
    providersOfPage,
} from "./connectionProvider.shared"

/** What a provider page reads: its band, the slot of its body and the retry. */
export interface ConnectionProviderRead {
    /** The band, known without the connections. */
    readonly head: ConnectionProviderHead
    readonly slot: DataSlot<ConnectionProviderView>
    readonly retry: () => void
}

/**
 * The provider page `/connections/<segment>`: the band (title, mark, group and count, the unit-specific add command that opens the
 * wizard on the hub), and the body (the figures, one row per connection, what the library says about the provider). A staff member
 * reads nothing; only the owner may add.
 */
export const useConnectionProvider = (segment: string): ConnectionProviderRead => {
    const t = useTranslations("connections")
    const tGrant = useTranslations("agentConnections")
    const format = useFormatter()
    const now = useNow()
    const bankName = useBankName()
    const workspaceId = useWorkspaceId()
    const access = useConnectionsRole()
    const data = useConnectionsData()
    const grantsRead = useQueryConnectionAgentGrantsSwr()
    const grants = grantsRead.data ?? []
    const providers = providersOfPage(segment)
    const provider = providers[0] ?? "webhook"
    const hubHref = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const connections = connectionsOfPage(data.items, providers)
    const isRead = "items" in data.slot
    const unitKey = `add_${unitOfProvider(provider)}`
    const head: ConnectionProviderHead = {
        title: t(providerKey(provider, "title")),
        ...(PROVIDER_LOGO[provider] === undefined ? {} : { markSrc: PROVIDER_LOGO[provider] }),
        meta: metaOf(provider, isRead ? connections.length : undefined, t),
        addLabel: t(unitKey),
        addHref: providerAddHref(hubHref, provider),
    }
    const lastEvent = latestEventOf(connections)
    const view: ConnectionProviderView = {
        canAdd: access.role === "owner",
        figures: figuresOf(
            connections,
            provider,
            data.agentNames,
            lastEvent === "" ? "" : format.relativeTime(new Date(lastEvent), now),
            t,
        ),
        rows: connections.map((connection) =>
            providerRowOf(connection, t, bankName, workspaceId, agentUsesOf(grants, connection.id, tGrant)),
        ),
        count: String(connections.length),
        about: aboutOf(provider, t),
    }
    const read = slotOfReads([access.read, ...data.reads, grantsRead], () => view)
    const manager = access.role === "owner" || access.role === "manager"
    return {
        head,
        slot:
            "items" in read ? boardSlotOf({ isLoading: false, isManager: manager, isFailed: false }, read.items) : read,
        retry: () => {
            access.retry()
            data.retry()
            void grantsRead.mutate()
        },
    }
}
