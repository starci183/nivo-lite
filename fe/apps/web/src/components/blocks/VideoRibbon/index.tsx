"use client"

import { useTranslations } from "next-intl"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useVideoLibrary } from "@/hooks/video"
import { VideoRibbonBase } from "./component"

/** The connected ribbon of the Video workbench, read with its library. */
export const VideoRibbon = () => {
    const t = useTranslations("video")
    const frame = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const library = useVideoLibrary()
    return (
        <VideoRibbonBase
            props={{
                label: frame("ribbonAria"),
                slot: slotOfSwr({
                    data: library.figuresFailed || library.isLoading ? undefined : library.figures,
                    error: library.figuresFailed ? t("loadFailedBody") : undefined,
                    isLoading: library.isLoading,
                }),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: library.figures,
            }}
            on={{ retry: library.reload }}
        />
    )
}
