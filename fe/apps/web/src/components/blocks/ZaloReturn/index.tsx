"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { useReturnZaloAuthorization } from "@/hooks/connections"
import type { ZaloReturnInput } from "@/hooks/connections"
import { navigation } from "@/modules/i18n"
import { ZaloReturnBase } from "./component"

/** What Zalo sends the browser back with. */
type ZaloReturnProps = ZaloReturnInput

/** Hands the Zalo return to the back end once, then lands the browser back on Connections with the verdict. */
export const ZaloReturn = (props: ZaloReturnProps) => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const returnAuthorization = useReturnZaloAuthorization()
    const handed = useRef(false)
    const { code, oaId, state } = props
    useEffect(() => {
        if (handed.current) return
        handed.current = true
        void returnAuthorization({ code, oaId, state }).then((href) => router.replace(href))
    }, [returnAuthorization, router, code, oaId, state])
    return <ZaloReturnBase props={{ waiting: t("zaloReturning") }} />
}
