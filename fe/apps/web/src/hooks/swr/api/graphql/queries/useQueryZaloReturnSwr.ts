"use client"

import { navigation } from "@/modules/i18n"
import { isRefusedByBackend } from "@/modules/failure"
import useSWR from "swr"
import { useMutateReturnZaloAuthorizationSwr } from "../mutations/useMutateReturnZaloAuthorizationSwr"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
interface ZaloReturnInput {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/** The Connections address carrying the verdict shown by the wizard. */
const connectionsHref = (verdict: string, connectionId?: string): string =>
    `/connections?zalo=${verdict}${connectionId === undefined ? "" : `&id=${connectionId}`}`

/** The SWR key of one Zalo return. */
const ZALO_RETURN_SWR_KEY = "zalo-return"

/** Hands the Zalo return to the back end once, then navigates to Connections with the verdict. */
export const useQueryZaloReturnSwr = ({ code, oaId, state }: ZaloReturnInput) => {
    const router = navigation.useRouter()
    const { trigger } = useMutateReturnZaloAuthorizationSwr()
    useSWR(
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
                    isRefusedByBackend(error) ? "denied" : "failed",
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
