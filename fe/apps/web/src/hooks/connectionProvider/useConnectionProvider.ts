"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
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
    type ConnectionAgentGrantWire,
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
 * reads nothing; only the owner may add. The `[provider]` loading route hands no segment (a loading boundary knows no params): the
 * address names it.
 */
export const useConnectionProvider = (given?: string): ConnectionProviderRead => {
    const params = useParams<{ provider?: string }>()
    const segment = given ?? params.provider ?? ""
    const t = useTranslations("connections")
    const tGrant = useTranslations("agentConnections")
    const format = useFormatter()
    const now = useNow()
    const bankName = useBankName()
    const workspaceId = useWorkspaceId()
    const access = useConnectionsRole()
    const data = useConnectionsData()
    const grantsRead = useQueryConnectionAgentGrantsSwr()
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
    /** The view needs the grants, so it is only built once that read has answered (a read in flight is the slot's loading, never an empty list). */
    const viewOf = (grants: ReadonlyArray<ConnectionAgentGrantWire>): ConnectionProviderView => ({
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
    })
    const grants = grantsRead.data
    const read = slotOfReads([access.read, ...data.reads, grantsRead], () =>
        grants === undefined ? undefined : viewOf(grants),
    )
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
