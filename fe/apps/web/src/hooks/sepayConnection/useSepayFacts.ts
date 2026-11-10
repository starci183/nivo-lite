"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, SepayConnectionView, ZaloFactView } from "@/modules/types"
import { useSepayConnection } from "./useSepayConnection"

/** The connection details of a SePay connection as term and value rows: bank, account, holder, environment, webhook, key, health. */
export const useSepayFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const { slot } = useSepayConnection(connectionId)
    const factsOf = (connection: SepayConnectionView): ReadonlyArray<ZaloFactView> => {
        const last = connection.health.lastWebhookAt
        return [
            { id: "bank", label: t("factBank"), value: connection.bank },
            { id: "account", label: t("factAccount"), value: connection.accountMasked },
            { id: "holder", label: t("factHolder"), value: connection.holder },
            {
                id: "environment",
                label: t("factEnvironment"),
                value: t(connection.environment === "test" ? "envTest" : "envLive"),
            },
            { id: "webhook", label: t("factWebhookUrl"), value: connection.webhookUrl },
            { id: "key", label: t("factApiKey"), value: connection.apiKeyMasked },
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
