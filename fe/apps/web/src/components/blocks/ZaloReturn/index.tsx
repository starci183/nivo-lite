"use client"

import { useTranslations } from "next-intl"
import { useQueryZaloReturnSwr } from "@/hooks/connections"
import type { ZaloReturnInput } from "@/hooks/connections"
import { ZaloReturnBase } from "./component"

/** What Zalo sends the browser back with. */
type ZaloReturnProps = ZaloReturnInput

/** Hands the Zalo return to the back end once, then lands the browser back on Connections with the verdict. */
export const ZaloReturn = (props: ZaloReturnProps) => {
    const t = useTranslations("connections")
    useQueryZaloReturnSwr(props)
    return <ZaloReturnBase props={{ waiting: t("zaloReturning") }} />
}
