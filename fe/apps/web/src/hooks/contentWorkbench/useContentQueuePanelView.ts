"use client"
import type { ContentViews, ContentActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    postView,
    quotes,
    useContentFocus,
    useContentItemActions,
    useContentCommand,
    type ContentNote,
} from "@/hooks/content"
import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"
import type { ContentViewInput } from "./contentWorkbench.shared"

interface Deciding {
    readonly id: string
    readonly decision: "approved" | "rejected"
}
/** Owns the actual ContentQueuePanel data derivations and conditional controller lifetime. */
export const useContentQueuePanelView = (input: ContentViewInput) => {
    const data = input.data
    const t = useTranslations("content")
    const actions = useContentItemActions()
    const command = useContentCommand(input.isActive && input.isReady, input.scope)
    const focus = useContentFocus()
    const [busy, setBusy] = useState<Deciding | null>(null)
    const [notes, setNotes] = useState<Readonly<Record<string, ContentNote>>>({})
    const lifetime = useFeatureLifetime(input.isActive, input.scope)
    const decide = (id: string, decision: "approved" | "rejected") => {
        if (!input.isActive || !input.isReady || data === undefined || !data.canManage) return
        const isCurrent = lifetime.capture()
        const workItemId = data.items.find((i) => i.id === id)?.work_item_id
        if (workItemId === null || workItemId === undefined) return
        setBusy({ id, decision })
        setNotes((cur) => Object.fromEntries(Object.entries(cur).filter(([key]) => key !== id)))
        command.run(
            "decide",
            async () => {
                try {
                    return await actions.decide(workItemId, decision)
                } finally {
                    if (isCurrent()) setBusy(null)
                }
            },
            () =>
                setNotes((cur) => ({
                    ...cur,
                    [id]: { tone: "ok", text: t(decision === "approved" ? "queueApproved" : "queueRejected") },
                })),
        )
    }
    const pillarNames = Object.fromEntries((data?.pillars ?? []).map((p) => [p.id, p.name]))

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            setBusy(null)
            setNotes({})
        },
    })

    const props: ContentViews["queueFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
                  waiting: data.items
                      .filter((i) => i.status === "waiting_approval")
                      .map((i) => ({
                          post: postView(t, i, pillarNames),
                          quotes: quotes(t, i),
                          hasDecision: i.work_item_id !== null,
                      })),
                  ready: data.items.filter((i) => i.status === "approved").map((i) => postView(t, i, pillarNames)),
                  canDecide: data.canManage,
                  isPending: command.isPending,
                  busy,
                  notes,
              }
    const on: ContentActions["queueActions"] = { decide, open: focus.open }
    return { props, on }
}
