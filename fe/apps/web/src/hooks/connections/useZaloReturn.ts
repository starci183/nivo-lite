"use client"

import useSWR from "swr"
import { navigation } from "@/modules/i18n"
import { useReturnZaloAuthorization } from "./useReturnZaloAuthorization"
import type { ZaloReturnInput } from "./useReturnZaloAuthorization"

/** The SWR key of one Zalo return. */
const ZALO_RETURN_SWR_KEY = "zalo-return"

/** Hands the Zalo return to the back end once, then navigates to Connections with the verdict. */
export const useZaloReturn = ({ code, oaId, state }: ZaloReturnInput) => {
    const router = navigation.useRouter()
    const returnAuthorization = useReturnZaloAuthorization()
    useSWR(
        [ZALO_RETURN_SWR_KEY, code ?? "", oaId ?? "", state ?? ""] as const,
        () => returnAuthorization({ code, oaId, state }),
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
