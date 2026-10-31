"use client"

import { useTranslations } from "next-intl"
import type { SepayConnectionView } from "@/modules/types"

/** The settings to set on the SePay webhook, worded for this connection. */
export const useSepaySettings = (connection: SepayConnectionView | undefined) => {
    const t = useTranslations("sepayConnection")
    return [
        { id: "name", label: t("settingName"), value: t("settingNameValue", { name: connection?.name ?? "" }) },
        { id: "events", label: t("settingEvents"), value: t("settingEventsValue") },
        { id: "format", label: t("settingFormat"), value: "JSON" },
        { id: "retry", label: t("settingRetry"), value: t("settingRetryValue") },
        {
            id: "account",
            label: t("settingAccount"),
            value: connection === undefined ? "-" : `${connection.bank} ${connection.accountMasked}`,
        },
    ]
}
