"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { connectionCheckOf } from "@/hooks/connection-wire"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateCheckConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateCheckConnectionSwr"
import { useMutateConnectTelegramSwr } from "@/hooks/swr/api/graphql/mutations/useMutateConnectTelegramSwr"
import type { ConnectionCheck, TelegramConnected } from "@/modules/types"

/** The GraphQL commands of the Telegram wizard (the active workspace travels in the request header). */
export interface TelegramCommands {
    readonly connect: (form: { readonly name: string; readonly token: string }) => Promise<Settled<TelegramConnected>>
    readonly check: (connectionId: string) => Promise<Settled<ConnectionCheck>>
}

/** The Telegram wizard's mutations bound to the toast helper. */
export const useTelegramCommands = (): TelegramCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerConnect } = useMutateConnectTelegramSwr()
    const { trigger: triggerCheck } = useMutateCheckConnectionSwr()
    return useMemo(
        () => ({
            connect: async (form) => {
                const settled = await settle(() => triggerConnect(form))
                if (settled.kind !== "ok") return settled
                await refresh()
                return {
                    kind: "ok",
                    value: {
                        connection: { id: settled.value.connection.id },
                        webhookRegistered: settled.value.webhookRegistered,
                    },
                }
            },
            check: async (connectionId) => {
                const settled = await settle(() => triggerCheck({ connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: connectionCheckOf(settled.value) } : settled
            },
        }),
        [settle, refresh, triggerConnect, triggerCheck],
    )
}
