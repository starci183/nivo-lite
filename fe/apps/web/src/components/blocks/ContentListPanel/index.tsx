"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { CONTENT_STATUSES, postView, useContentFocus, useContentData } from "@/hooks/content"
import { ContentListPanelBase } from "./component"

/** The List tab: every post soonest first, filtered by status; a row opens the post editor. */
export const ContentListPanel = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const focus = useContentFocus()
    const [filter, setFilter] = useState("all")
    const pillarNames = Object.fromEntries(data.pillars.map((p) => [p.id, p.name]))
    return (
        <ContentListPanelBase
            props={{
                t,
                shown: data.items
                    .filter((i) => filter === "all" || i.status === filter)
                    .sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"))
                    .map((i) => postView(t, i, pillarNames)),
                filters: [
                    { id: "all", label: t("filterAll") },
                    ...CONTENT_STATUSES.map((s) => ({
                        id: s,
                        label: `${t(`status_${s}`)} (${data.items.filter((i) => i.status === s).length})`,
                    })),
                ],
                filter,
            }}
            on={{ filter: setFilter, open: focus.open }}
        />
    )
}
