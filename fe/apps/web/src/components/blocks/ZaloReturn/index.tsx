"use client"

import { useTranslations } from "next-intl"
import { useQueryZaloReturnSwr } from "@/hooks/connections"
import type { ZaloReturnInput } from "@/hooks/connections"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ZaloReturnBase } from "./component"

/** What Zalo sends the browser back with. */
type ZaloReturnProps = ZaloReturnInput

/** Hands the Zalo return to the back end once, then lands the browser on the page it reconnected from, or on Connections with the verdict. */
export const ZaloReturn = (props: ZaloReturnProps) => {
    const t = useTranslations("connections")
    const shell = useTranslations("shell")
    const slotLabelsOf = useSlotLabels()
    const read = useQueryZaloReturnSwr(props)
    return (
        <ZaloReturnBase
            props={{
                crumbLabel: shell("crumbLabel"),
                crumbs: [
                    { id: "home", label: shell("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "connections", label: t("title"), href: CONSOLE_ROUTES.connections },
                    { id: "zalo", label: t("zaloReturnTitle") },
                ],
                title: t("zaloReturnTitle"),
                markSrc: PROVIDER_LOGO.zalo_oa ?? "",
                heading: t("zaloReturning"),
                waiting: t("zaloReturningBody"),
                progressLabel: t("zaloReturning"),
                errorDescription: t("zaloReturnFailed"),
                landing: slotOfSwr(read),
                slotLabels: slotLabelsOf(""),
            }}
            on={{
                retry: () => {
                    void read.mutate()
                },
            }}
        />
    )
}
