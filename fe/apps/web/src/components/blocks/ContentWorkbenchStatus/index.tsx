"use client"

import { useTranslations } from "next-intl"
import { useContentWorkbench } from "@/hooks/content"
import { ContentWorkbenchStatusBase } from "./component"

/** Tells the reader when the content workbench could not be read; nothing while it loads or reads fine. */
export const ContentWorkbenchStatus = () => {
    const t = useTranslations("content")
    const workbench = useContentWorkbench()
    return workbench.error ? (
        <ContentWorkbenchStatusBase props={{ title: t("loadFailedTitle"), body: t("loadFailedBody") }} />
    ) : null
}
