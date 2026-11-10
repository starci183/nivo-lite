"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { useDrivePage } from "./useDrivePage"
import { useDriveProgress } from "./useDriveProgress"

/**
 * The facts of the Drive connection: what the grant allows, which Google account gave it, how many documents NIVO read from Drive and
 * when the newest came in, and how much of the workspace's raw document allowance is used. The back end reports no list of the chosen
 * folders, so the documents read stand for them.
 */
export const useDriveFacts = (enabled = true): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("driveConnection")
    const { slot } = useDrivePage(enabled)
    const { count, isLoaded, lastAt } = useDriveProgress(enabled)
    const usage = useQueryKnowledgeUsageSwr(enabled)
    const format = useFormatter()
    const megabytes = (bytes: number): string => format.number(Math.round(bytes / (1024 * 1024)))
    return mapSlot(slot, (page) => [
        { id: "scope", label: t("tileScope"), value: t("tileScopeValue"), meta: t("tileScopeMeta") },
        {
            id: "account",
            label: t("tileAccount"),
            value: page.email === "" ? t("tileAccountNone") : page.email,
        },
        {
            id: "documents",
            label: t("factDocuments"),
            value: isLoaded ? t("factDocumentsValue", { count }) : "-",
        },
        {
            id: "last",
            label: t("factLastRead"),
            value:
                lastAt === null
                    ? t("factLastReadNone")
                    : format.dateTime(new Date(lastAt), { dateStyle: "short", timeStyle: "short" }),
        },
        {
            id: "usage",
            label: t("tileUsage"),
            value: usage.data === undefined ? "-" : t("tileUsageValue", { used: megabytes(usage.data.usedBytes) }),
            meta:
                usage.data === undefined
                    ? t("tileUsageMeta")
                    : t("tileUsageLimit", { limit: megabytes(usage.data.limitBytes) }),
        },
    ])
}
