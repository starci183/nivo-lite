"use client"

import { useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, ZaloFactView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The saved values of the first setup step: the app keys, the secret masked to its last four characters. */
export const useZaloSetupFacts = (connectionId: string): DataSlot<ReadonlyArray<ZaloFactView>> => {
    const t = useTranslations("zaloConnection")
    const { slot } = useZaloPage(connectionId)
    return mapSlot(slot, (page) => [
        { id: "appId", label: t("factAppId"), value: page.appId === "" ? "-" : page.appId },
        { id: "appSecret", label: t("factAppSecret"), value: page.appSecretMask ?? t("factNotSaved") },
    ])
}
