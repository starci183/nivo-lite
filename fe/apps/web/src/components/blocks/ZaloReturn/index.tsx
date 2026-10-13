"use client"

import { useTranslations } from "next-intl"
import useSWR from "swr"
import { useReturnZaloAuthorization } from "@/hooks/connections"
import type { ZaloReturnInput } from "@/hooks/connections"
import { navigation } from "@/modules/i18n"
import { ZaloReturnBase } from "./component"

/** What Zalo sends the browser back with. */
type ZaloReturnProps = ZaloReturnInput

/** The SWR key of one Zalo return. */
const ZALO_RETURN_SWR_KEY = "zalo-return"

/** Hands the Zalo return to the back end once, then lands the browser back on Connections with the verdict. */
export const ZaloReturn = (props: ZaloReturnProps) => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const returnAuthorization = useReturnZaloAuthorization()
    const { code, oaId, state } = props
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
    return <ZaloReturnBase props={{ waiting: t("zaloReturning") }} />
}
