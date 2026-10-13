"use client"

import { useTranslations } from "next-intl"
import { useContentWorkbench } from "@/hooks/content"
import { ContentReadOnlyNoticeBase } from "./component"

/** Tells a member who may not manage the content that the settings are read-only. */
export const ContentReadOnlyNotice = () => {
    const t = useTranslations("content")
    const { data } = useContentWorkbench()
    return data && !data.canManage ? <ContentReadOnlyNoticeBase props={{ title: t("readOnly") }} /> : null
}
