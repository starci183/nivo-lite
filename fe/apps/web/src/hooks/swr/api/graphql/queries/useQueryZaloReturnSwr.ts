"use client"

import { navigation } from "@/modules/i18n"
import { graphQLErrorCode, isRefusedByBackend, zaloReturnVerdictOf } from "@/modules/failure"
import { CONSOLE_ROUTES, workspaceHref, zaloConnectionHref } from "@/modules/routes"
import { LocalStorage, StorageId } from "@/modules/storage"
import useSWR from "swr"
import { useMutateReturnZaloAuthorizationSwr } from "../mutations/useMutateReturnZaloAuthorizationSwr"
import type { ReadResponse } from "@/hooks/workspaceread"
import { useWorkspaceKey } from "@/hooks/workspaceKey"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
export interface ZaloReturnInput {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/** The connection the owner left from the page of its own to reconnect, read once: the return lands back on that page. */
const takeReturnTarget = (): string | undefined => {
    const from = LocalStorage.get<string>(StorageId.ZaloReturn)
    LocalStorage.remove(StorageId.ZaloReturn)
    return from
}

/** Where the browser lands: the connection's own page when the owner reconnected from it and it worked, else Connections with the verdict the wizard shows. */
const connectionsHref = (workspaceId: string, verdict: string, connectionId?: string): string => {
    const returnTarget = takeReturnTarget()
    if (verdict === "ok" && connectionId !== undefined && returnTarget === connectionId)
        return workspaceHref(workspaceId, zaloConnectionHref(connectionId))
    const connection = connectionId === undefined ? "" : `&id=${connectionId}`
    return workspaceHref(workspaceId, `${CONSOLE_ROUTES.connections}?zalo=${verdict}${connection}`)
}

/** The SWR key of one Zalo return. */
const ZALO_RETURN_SWR_KEY = "zalo-return"

/** Hands the Zalo return to the back end once, then navigates to the connection's page (reconnect from it) or to Connections with the verdict. */
export const useQueryZaloReturnSwr = ({ code, oaId, state }: ZaloReturnInput): ReadResponse<string> => {
    const router = navigation.useRouter()
    const key = useWorkspaceKey(ZALO_RETURN_SWR_KEY, [code ?? "", oaId ?? "", state ?? ""])
    const workspaceId = key === null ? "" : key[1]
    const { trigger } = useMutateReturnZaloAuthorizationSwr()
    return useSWR(
        key,
        async () => {
            const authorizationState = state ?? ""
            if (code === undefined || authorizationState === "") return connectionsHref(workspaceId, "denied")
            try {
                const connection = await trigger({
                    state: authorizationState,
                    code,
                    ...(oaId === undefined ? {} : { oaId }),
                })
                return connectionsHref(workspaceId, "ok", connection.id)
            } catch (error) {
                return connectionsHref(
                    workspaceId,
                    zaloReturnVerdictOf(graphQLErrorCode(error), isRefusedByBackend(error)),
                    authorizationState.split(".")[0],
                )
            }
        },
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
            onSuccess: (href) => {
                router.replace(href)
            },
        },
    )
}
