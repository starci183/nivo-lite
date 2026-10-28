"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, ZaloFactView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The facts of the overview tab: the state of the OA at a glance. */
export const useZaloOverviewFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const { slot } = useZaloPage(connectionId)
    return mapSlot(slot, (page) => [
        { id: "status", label: t("factStatus"), value: page.healthy ? t("chipOk") : t("chipCheck") },
        {
            id: "token",
            label: t("factToken"),
            value:
                page.access.expiresAt === null
                    ? t("factTokenNone")
                    : format.dateTime(new Date(page.access.expiresAt), { dateStyle: "short", timeStyle: "short" }),
        },
        { id: "oaId", label: t("factOaId"), value: page.oaId === "" ? "-" : page.oaId },
        { id: "appId", label: t("factAppId"), value: page.appId === "" ? "-" : page.appId },
        { id: "followers", label: t("factFollowers"), value: String(page.recipients.length) },
        { id: "agents", label: t("factAgents"), value: String(page.agentIds.length) },
    ])
}
