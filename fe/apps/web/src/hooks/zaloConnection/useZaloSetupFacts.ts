"use client"

import { useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, ZaloFactView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The facts of the setup tab: what is saved, every secret masked to its last four characters. */
export const useZaloSetupFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("zaloConnection")
    const { slot } = useZaloPage(connectionId)
    return mapSlot(slot, (page) => [
        { id: "appId", label: t("factAppId"), value: page.appId === "" ? "-" : page.appId },
        { id: "appSecret", label: t("factAppSecret"), value: page.appSecretMask ?? t("factNotSaved") },
        { id: "oaSecret", label: t("factOaSecret"), value: page.oaSecretMask ?? t("factNotSaved") },
        { id: "oaId", label: t("factOaId"), value: page.oaId === "" ? "-" : page.oaId },
    ])
}
