"use client"

import { useTranslations } from "next-intl"
import { useVideoLibrary } from "@/hooks/video"
import { VideoRibbonBase } from "./component"

/** The connected ribbon of the Video workbench, read with its library. */
export const VideoRibbon = () => {
    const t = useTranslations("video")
    const frame = useTranslations("agentDashboard")
    const library = useVideoLibrary()
    return (
        <VideoRibbonBase
            props={{
                label: frame("ribbonAria"),
                isLoading: library.isLoading,
                isFailed: library.figuresFailed,
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                items: library.figures,
            }}
        />
    )
}
