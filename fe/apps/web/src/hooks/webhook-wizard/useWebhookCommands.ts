"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { webhookVerdictOf, webhookViewOf } from "@/hooks/connection-wire"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateFinishWebhookConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateFinishWebhookConnectionSwr"
import { useMutateStartWebhookConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateStartWebhookConnectionSwr"
import { useMutateTestWebhookConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateTestWebhookConnectionSwr"
import type { WebhookTestVerdict, WebhookView } from "@/modules/types"

/** The GraphQL commands of the webhook wizard (the active workspace travels in the request header). */
export interface WebhookCommands {
    readonly start: (
        form: { readonly name: string; readonly url: string },
        events: ReadonlyArray<string>,
    ) => Promise<Settled<WebhookView>>
    readonly test: (connectionId: string) => Promise<Settled<WebhookTestVerdict>>
    readonly finish: (connectionId: string) => Promise<Settled<true>>
}

/** The webhook wizard's mutations bound to the toast helper. */
export const useWebhookCommands = (): WebhookCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerStart } = useMutateStartWebhookConnectionSwr()
    const { trigger: triggerTest } = useMutateTestWebhookConnectionSwr()
    const { trigger: triggerFinish } = useMutateFinishWebhookConnectionSwr()
    return useMemo(
        () => ({
            start: async (form, events) => {
                const settled = await settle(() => triggerStart({ ...form, events: [...events] }))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: webhookViewOf(settled.value) }
            },
            test: async (connectionId) => {
                const settled = await settle(() => triggerTest({ connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: webhookVerdictOf(settled.value) } : settled
            },
            finish: async (connectionId) => {
                const settled = await settle(() => triggerFinish({ connectionId }))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: true }
            },
        }),
        [settle, refresh, triggerStart, triggerTest, triggerFinish],
    )
}
