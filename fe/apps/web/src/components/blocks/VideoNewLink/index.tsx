"use client"

import { useTranslations } from "next-intl"
import { editorHref, useVideoCanEdit } from "@/hooks/video"
import { VideoNewLinkBase } from "./component"

/** The "new video" command of the workbench header: a link to the wizard's first step. */
export const VideoNewLink = () => {
    const t = useTranslations("video")
    const canEdit = useVideoCanEdit()
    return canEdit ? <VideoNewLinkBase props={{ label: t("newVideo"), href: editorHref("new", "goal") }} /> : null
}
