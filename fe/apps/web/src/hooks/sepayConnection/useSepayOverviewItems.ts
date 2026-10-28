"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { DescriptionListItem } from "@starci/grammar/common"
import { mapSlot } from "@/hooks/slot"
import type { SepayConnectionView } from "@/modules/types"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"

/** The summary rows of a SePay connection, worded, with the slot they come from and a same-shape placeholder. */
export const useSepayOverviewItems = (connectionId: string) => {
    const { slot, retry } = useSepayConnection(connectionId)
    const placeholder = useSepayPlaceholder()
    const format = useFormatter()
    const t = useTranslations("sepayConnection")
    const itemsOf = (connection: SepayConnectionView): ReadonlyArray<DescriptionListItem> => {
        const last = connection.health.lastWebhookAt
        return [
            {
                id: "account",
                term: t("overviewAccount"),
                description: `${connection.bank} ${connection.accountMasked} - ${connection.holder}`,
            },
            {
                id: "env",
                term: t("overviewEnvironment"),
                description: t(connection.environment === "test" ? "envTest" : "envLive"),
            },
            {
                id: "last",
                term: t("tileLast"),
                description: last === null ? t("tileNever") : format.relativeTime(new Date(last)),
            },
            {
                id: "agents",
                term: t("overviewAgents"),
                description: t("overviewAgentCount", { count: connection.agentIds.length }),
            },
        ]
    }
    return { slot: mapSlot(slot, itemsOf), placeholder: itemsOf(placeholder), retry }
}
