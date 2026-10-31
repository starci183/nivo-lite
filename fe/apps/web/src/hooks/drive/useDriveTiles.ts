"use client"

import { useTranslations } from "next-intl"
import type { ConnectionTilesView } from "@/modules/types"
import { useDriveFacts } from "./useDriveFacts"
import { useDrivePage } from "./useDrivePage"

/** The health tiles of the Google Drive page and the sentence for when there is nothing to show; nothing is read while `enabled` is false. */
export const useDriveTiles = (enabled: boolean): ConnectionTilesView => {
    const t = useTranslations("driveConnection")
    const { reload } = useDrivePage(enabled)
    return { facts: useDriveFacts(enabled), emptyLabel: t("factsEmpty"), retry: reload }
}
