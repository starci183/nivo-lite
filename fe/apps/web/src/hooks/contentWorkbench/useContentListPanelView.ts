"use client"
import type { ContentViews, ContentActions, ContentListFields, ContentListActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { CONTENT_STATUSES, postView, useContentFocus } from "@/hooks/content"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** The view `useContentListPanelView` returns. */
export interface ContentListPanelView {
    props: ContentListFields | undefined
    on: ContentListActions
}

/** Owns the actual ContentListPanel data derivations and conditional controller lifetime. */
export const useContentListPanelView = (input: ContentViewInput): ContentListPanelView => {
    const data = input.data
    const t = useTranslations("content")
    const focus = useContentFocus()
    const [filter, setFilter] = useState("all")
    const pillarNames = Object.fromEntries((data?.pillars ?? []).map((p) => [p.id, p.name]))

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            setFilter("all")
        },
    })

    const props: ContentViews["listFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
                  isEmpty: data.items.every((item) => filter !== "all" && item.status !== filter),
                  shown: data.items
                      .filter((i) => filter === "all" || i.status === filter)
                      .sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"))
                      .map((i) => postView(t, i, pillarNames)),
                  filters: [
                      { id: "all", label: t("filterAll") },
                      ...CONTENT_STATUSES.map((s) => ({
                          id: s,
                          label: `${t("status_" + s)} (${data.items.filter((i) => i.status === s).length})`,
                      })),
                  ],
                  filter,
              }
    const on: ContentActions["listActions"] = { filter: setFilter, open: focus.open }
    return { props, on }
}
