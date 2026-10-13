"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { zaloWizardOf } from "@/hooks/connection-wire"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateAuthorizeZaloSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAuthorizeZaloSwr"
import { useMutateSaveZaloOaSecretSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveZaloOaSecretSwr"
import { useMutateStartZaloConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateStartZaloConnectionSwr"
import type { ZaloWizardConnection } from "@/modules/types"
import type { ZaloFields } from "./zalo-wizard.shared"

/** The GraphQL commands of the Zalo wizard (the active workspace travels in the request header). */
export interface ZaloCommands {
    readonly start: (fields: Pick<ZaloFields, "name" | "appId" | "appSecret">) => Promise<Settled<ZaloWizardConnection>>
    readonly saveOaSecret: (connectionId: string, oaSecret: string) => Promise<Settled<ZaloWizardConnection>>
    /** Where to send the browser to grant the OA permissions. */
    readonly authorize: (connectionId: string) => Promise<Settled<string>>
}

/** The Zalo wizard's mutations bound to the toast helper. */
export const useZaloCommands = (): ZaloCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerStart } = useMutateStartZaloConnectionSwr()
    const { trigger: triggerSecret } = useMutateSaveZaloOaSecretSwr()
    const { trigger: triggerAuthorize } = useMutateAuthorizeZaloSwr()
    return useMemo(
        () => ({
            start: async (fields) => {
                const settled = await settle(() => triggerStart(fields))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: zaloWizardOf(settled.value) }
            },
            saveOaSecret: async (connectionId, oaSecret) => {
                const settled = await settle(() => triggerSecret({ connectionId, oaSecret }))
                return settled.kind === "ok" ? { kind: "ok", value: zaloWizardOf(settled.value) } : settled
            },
            authorize: async (connectionId) => {
                const settled = await settle(() => triggerAuthorize({ connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: settled.value.url } : settled
            },
        }),
        [settle, refresh, triggerStart, triggerSecret, triggerAuthorize],
    )
}
