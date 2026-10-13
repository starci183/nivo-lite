"use client"

import { useTranslations } from "next-intl"
import { ContentWorkbenchLoadingPageBase } from "./component"

/** The Content workbench while it loads: the frame's own tree, the four figure terms and the five tab labels real, values and lists as skeleton. */
export const ContentWorkbenchLoadingPage = () => {
    const t = useTranslations("content")
    const figures = useTranslations("workbenchFigures")
    return (
        <ContentWorkbenchLoadingPageBase
            props={{
                figures: [
                    { id: "waiting", term: figures("ctWaiting"), description: "" },
                    { id: "published", term: figures("ctPublished"), description: "" },
                    { id: "next", term: figures("ctNext"), description: "" },
                    { id: "pillars", term: figures("ctPillars"), description: "" },
                ],
                tabs: [
                    { id: "calendar", label: t("tabCalendar") },
                    { id: "list", label: t("tabList") },
                    { id: "queue", label: t("tabQueue") },
                    { id: "balance", label: t("tabBalance") },
                    { id: "settings", label: t("tabSettings") },
                ],
            }}
        />
    )
}
