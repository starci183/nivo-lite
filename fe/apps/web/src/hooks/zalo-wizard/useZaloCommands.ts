"use client"

import { useCallback, useMemo } from "react"
import { useSettledGraphQL, useZaloFailureLabel } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { zaloWizardOf } from "@/hooks/connection-wire"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateAuthorizeZaloSwr, useMutateSaveZaloOaSecretSwr, useMutateStartZaloConnectionSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { ZaloWizardConnection } from "@/modules/types"
import type { ZaloFields } from "./zalo-wizard.shared"

/** The GraphQL commands of the Zalo wizard (the workspace of the address travels in the request header). */
export interface ZaloCommands {
    readonly start: (fields: Pick<ZaloFields, "name" | "appId" | "appSecret">) => Promise<Settled<ZaloWizardConnection>>
    readonly saveOaSecret: (connectionId: string, oaSecret: string) => Promise<Settled<ZaloWizardConnection>>
    /** Where to send the browser to grant the OA permissions. */
    readonly authorize: (connectionId: string) => Promise<Settled<string>>
}

/** The Zalo wizard's mutations bound to the toast helper. */
export const useZaloCommands = (): ZaloCommands => {
    const settleRaw = useSettledGraphQL()
    const labelOf = useZaloFailureLabel()
    const settle = useCallback(
        async <T>(action: () => Promise<T>): Promise<Settled<T>> => {
            const settled = await settleRaw(action)
            return settled.kind === "ok" ? settled : { ...settled, message: labelOf(settled.code, settled.message) }
        },
        [settleRaw, labelOf],
    )
    const refresh = useConnectionsRefresh()
    const workspaceId = useWorkspaceId()
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
                if (settled.kind !== "ok") return settled
                LocalStorage.set(StorageId.ZaloOAuthWorkspace, workspaceId)
                return { kind: "ok", value: settled.value.url }
            },
        }),
        [settle, refresh, triggerStart, triggerSecret, triggerAuthorize, workspaceId],
    )
}
