"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { useDrivePage } from "./useDrivePage"

/** The health tiles of the page: what the grant allows, whether a Google account gave it (its address under it), and how much of the raw document allowance is used. */
export const useDriveFacts = (enabled = true): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("driveConnection")
    const { slot } = useDrivePage(enabled)
    const usage = useQueryKnowledgeUsageSwr(enabled)
    const format = useFormatter()
    const megabytes = (bytes: number): string => format.number(Math.round(bytes / (1024 * 1024)))
    return mapSlot(slot, (page) => [
        { id: "scope", label: t("tileScope"), value: t("tileScopeValue"), meta: t("tileScopeMeta"), isText: true },
        {
            id: "account",
            label: t("tileAccount"),
            value: page.email === "" ? t("tileAccountNone") : t("tileAccountOk"),
            meta: page.email === "" ? t("tileAccountNoneMeta") : page.email,
            isText: true,
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
