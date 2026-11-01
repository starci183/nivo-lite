"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import {
    useMutateCheckConnectionSwr,
    useMutateCheckMetaSwr,
    useMutateDeleteConnectionSwr,
    useMutateRevealSepayKeySwr,
    useMutateTestWebhookConnectionSwr,
} from "@/hooks/swr"
import type { ConnectionCheck, MetaCheckSummary, Provider, SepayKeys, WebhookTestVerdict } from "@/modules/types"
import { connectionCheckOf, metaCheckSummaryOf, webhookVerdictOf } from "@/hooks/connection-wire"
import { useAuthorizeGoogle } from "./useAuthorizeGoogle"
import { useConnectionsRefresh } from "./useConnectionsRefresh"
import { useDisconnectConnection } from "./useDisconnectConnection"

/** The commands one connection row can run, already bound to its connection. */
export interface RowCommands {
    readonly check: () => Promise<Settled<ConnectionCheck>>
    readonly checkMeta: () => Promise<Settled<MetaCheckSummary>>
    readonly testWebhook: () => Promise<Settled<WebhookTestVerdict>>
    readonly sepayKeys: () => Promise<Settled<SepayKeys>>
    readonly reconnectGoogle: (returnTo: string) => Promise<Settled<string>>
    readonly disconnect: () => Promise<Settled<true>>
    readonly remove: () => Promise<Settled<true>>
}

/**
 * The GraphQL commands of the row of one connection: check, test, reveal the keys, reconnect Google, disconnect, remove. The Google
 * Drive row disconnects through the Drive grant itself, which also forgets its sealed tokens.
 */
export const useConnectionRowCommands = (connectionId: string, provider: Provider): RowCommands => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const reconnectGoogle = useAuthorizeGoogle()
    const { trigger: triggerCheck } = useMutateCheckConnectionSwr()
    const { trigger: triggerCheckMeta } = useMutateCheckMetaSwr()
    const { trigger: triggerTest } = useMutateTestWebhookConnectionSwr()
    const { trigger: triggerReveal } = useMutateRevealSepayKeySwr()
    const { trigger: triggerDisconnect } = useDisconnectConnection(provider)
    const { trigger: triggerRemove } = useMutateDeleteConnectionSwr()

    return useMemo(() => {
        const removed = async (settled: Settled<boolean>): Promise<Settled<true>> => {
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        }
        return {
            check: async () => {
                const settled = await settle(() => triggerCheck({ connectionId }))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: connectionCheckOf(settled.value) }
            },
            checkMeta: async () => {
                const settled = await settle(() => triggerCheckMeta({ connectionId, repair: false }))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: metaCheckSummaryOf(settled.value) }
            },
            testWebhook: async () => {
                const settled = await settle(() => triggerTest({ connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: webhookVerdictOf(settled.value) } : settled
            },
            sepayKeys: async () => {
                const settled = await settle(() => triggerReveal({ connectionId }))
                return settled.kind === "ok"
                    ? { kind: "ok", value: { apiKey: settled.value.apiKey, webhookUrl: settled.value.webhookUrl } }
                    : settled
            },
            reconnectGoogle,
            disconnect: async () =>
                removed(await settle(() => triggerDisconnect(connectionId), t("toastDisconnected"))),
            remove: async () => removed(await settle(() => triggerRemove({ connectionId }), t("toastRemoved"))),
        }
    }, [
        settle,
        refresh,
        t,
        connectionId,
        reconnectGoogle,
        triggerCheck,
        triggerCheckMeta,
        triggerTest,
        triggerReveal,
        triggerDisconnect,
        triggerRemove,
    ])
}
