"use client"

import { useTranslations } from "next-intl"
import { useUsageView } from "@/hooks/knowledge"
import { mapSlot } from "@/hooks/slot"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { useDrivePage } from "./useDrivePage"

/** The health tiles of the page: what the grant allows, which Google account gave it, and how much of the raw document allowance is used. */
export const useDriveFacts = (enabled = true): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("driveConnection")
    const { slot } = useDrivePage(enabled)
    const usage = useQueryKnowledgeUsageSwr(enabled)
    const usageView = useUsageView(usage.data)
    return mapSlot(slot, (page) => [
        { id: "scope", label: t("tileScope"), value: t("tileScopeValue"), meta: t("tileScopeMeta") },
        {
            id: "account",
            label: t("tileAccount"),
            value: page.email === "" ? t("factsNone") : page.email,
            meta: t("tileAccountMeta"),
        },
        {
            id: "usage",
            label: t("tileUsage"),
            value: usageView?.valueLabel ?? "-",
            meta: t("tileUsageMeta"),
        },
    ])
}
