"use client"

import { useTranslations } from "next-intl"
import type { ConnectionRailLinesView } from "@/modules/types"
import { useDriveProgress } from "./useDriveProgress"

/** The progress rail of the Google Drive page; nothing is read while `enabled` is false. */
export const useDriveRail = (enabled: boolean): ConnectionRailLinesView => {
    const t = useTranslations("driveConnection")
    const { lines, reload } = useDriveProgress(enabled)
    return {
        title: t("progressTitle"),
        liveLabel: t("progressLive"),
        footnote: t("progressFootnote"),
        emptyLabel: t("progressEmpty"),
        lines,
        retry: reload,
    }
}
