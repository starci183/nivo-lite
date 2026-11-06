"use client"

import { useTranslations } from "next-intl"
import { useZaloForward } from "@/hooks/connections"
import { ZaloForwardBase } from "./component"

/** What Zalo sends the browser back with. */
interface ZaloForwardProps {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/** Forwards the Zalo return into the workspace that started the authorization and says so while it does. */
export const ZaloForward = (props: ZaloForwardProps) => {
    const t = useTranslations("shell")
    useZaloForward(props)
    return <ZaloForwardBase props={{ label: t("loading") }} />
}
