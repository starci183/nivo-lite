"use client"

import { navigation } from "@/modules/i18n"
import { graphQLErrorCode, isRefusedByBackend, zaloReturnVerdictOf } from "@/modules/failure"
import { zaloConnectionHref } from "@/modules/routes"
import { LocalStorage, StorageId } from "@/modules/storage"
import useSWR from "swr"
import { useMutateReturnZaloAuthorizationSwr } from "../mutations/useMutateReturnZaloAuthorizationSwr"

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
const connectionsHref = (verdict: string, connectionId?: string): string => {
    const returnTarget = takeReturnTarget()
    if (verdict === "ok" && connectionId !== undefined && returnTarget === connectionId)
        return zaloConnectionHref(connectionId)
    const connection = connectionId === undefined ? "" : `&id=${connectionId}`
    return `/connections?zalo=${verdict}${connection}`
}

/** The SWR key of one Zalo return. */
const ZALO_RETURN_SWR_KEY = "zalo-return"

/** Hands the Zalo return to the back end once, then navigates to the connection's page (reconnect from it) or to Connections with the verdict. */
export const useQueryZaloReturnSwr = ({ code, oaId, state }: ZaloReturnInput) => {
    const router = navigation.useRouter()
    const { trigger } = useMutateReturnZaloAuthorizationSwr()
    return useSWR(
        [ZALO_RETURN_SWR_KEY, code ?? "", oaId ?? "", state ?? ""],
        async () => {
            const authorizationState = state ?? ""
            if (code === undefined || authorizationState === "") return connectionsHref("denied")
            try {
                const connection = await trigger({
                    state: authorizationState,
                    code,
                    ...(oaId === undefined ? {} : { oaId }),
                })
                return connectionsHref("ok", connection.id)
            } catch (error) {
                return connectionsHref(
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
