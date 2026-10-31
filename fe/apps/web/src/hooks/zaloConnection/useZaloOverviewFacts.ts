"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, ZaloFactView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"
import type { ZaloPageData } from "./useZaloPage"

/** The health tiles of the page: how long the token lasts, who wrote inside the 48 hours, how many agents work through the OA. */
export const useZaloOverviewFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const { slot } = useZaloPage(connectionId)
    const tokenOf = (page: ZaloPageData): Pick<ZaloFactView, "value" | "meta"> => {
        const { access } = page
        if (access.state === "none" || access.expiresAt === null)
            return { value: t("factTokenNone"), meta: t("tileTokenAsk") }
        const meta = access.canRefresh ? t("tileTokenAuto") : t("tileTokenManual")
        if (access.state === "expired") return { value: t("tileTokenExpired"), meta }
        return { value: format.relativeTime(new Date(access.expiresAt), new Date()), meta }
    }
    return mapSlot(slot, (page) => [
        { id: "token", label: t("tileToken"), ...tokenOf(page) },
        {
            id: "followers",
            label: t("factFollowers"),
            value: String(page.recipients.length),
            meta: t("tileFollowersMeta"),
        },
        { id: "agents", label: t("factAgents"), value: String(page.agentIds.length), meta: t("tileAgentsMeta") },
    ])
}
