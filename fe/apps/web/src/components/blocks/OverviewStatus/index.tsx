"use client"

import { useTranslations } from "next-intl"
import { useOverviewData } from "@/hooks/overview"
import { OverviewStatusBase } from "./component"

/** The connected overview failure notice: nothing while the dashboard loads or reads, an alert with a retry when it failed. */
export const OverviewStatus = () => {
    const shell = useTranslations("shell")
    const overview = useTranslations("overview")
    const { failed, retry } = useOverviewData()
    if (!failed) return null
    return (
        <OverviewStatusBase
            props={{ title: shell("errorTitle"), message: overview("loadFailed"), retryLabel: shell("retry") }}
            on={{ retry }}
        />
    )
}
