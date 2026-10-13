"use client"

import { useTranslations } from "next-intl"
import { useVideoFailed } from "@/hooks/video"
import { VideoWorkbenchStatusBase } from "./component"

/** What the page tells the status card. */
interface VideoWorkbenchStatusProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

/** Tells the reader when the video workbench could not be read; nothing while it loads or reads fine. */
export const VideoWorkbenchStatus = (props: VideoWorkbenchStatusProps) => {
    const t = useTranslations("video")
    const failed = useVideoFailed(props)
    return failed ? (
        <VideoWorkbenchStatusBase props={{ title: t("loadFailedTitle"), body: t("loadFailedBody") }} />
    ) : null
}
