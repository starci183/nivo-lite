"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, SepayConnectionView, ZaloFactView } from "@/modules/types"
import { useSepayConnection } from "./useSepayConnection"

/** What the webhook has done, as term and value rows: the latest webhook, the valid ones in 24 hours, the duplicates blocked. The bank, account, holder, environment, address and key are fields of the form. */
export const useSepayFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const { slot } = useSepayConnection(connectionId)
    const factsOf = (connection: SepayConnectionView): ReadonlyArray<ZaloFactView> => {
        const last = connection.health.lastWebhookAt
        return [
            {
                id: "last",
                label: t("tileLast"),
                value: last === null ? t("tileNever") : format.relativeTime(new Date(last), new Date()),
            },
            {
                id: "valid",
                label: t("tileValid"),
                value: `${connection.health.validCount}/${connection.health.totalCount}`,
            },
            { id: "duplicates", label: t("tileDuplicates"), value: String(connection.health.duplicateCount) },
        ]
    }
    return mapSlot(slot, factsOf)
}
