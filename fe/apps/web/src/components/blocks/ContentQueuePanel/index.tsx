"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { postView, quotes, useContentFocus, type ContentNote, type ContentWorkbenchData } from "@/hooks/content"
import { decideWorkItem } from "@/lib/flow-actions"
import { navigation } from "@/modules/i18n"
import { ContentQueuePanelBase } from "./component"

/** Props of {@link ContentQueuePanel}. */
export interface ContentQueuePanelProps {
    /** What the workbench read for the member. */
    readonly data: ContentWorkbenchData
}

interface Deciding {
    readonly id: string
    readonly decision: "approved" | "rejected"
}

/** The Approvals tab: posts waiting for the owner (decided through the publish gate) and the approved ones ready to post. */
export const ContentQueuePanel = (props: ContentQueuePanelProps) => {
    const t = useTranslations("content")
    const router = navigation.useRouter()
    const focus = useContentFocus()
    const { data } = props
    const [isPending, startTransition] = useTransition()
    const [busy, setBusy] = useState<Deciding | null>(null)
    const [notes, setNotes] = useState<Readonly<Record<string, ContentNote>>>({})
    const decide = (id: string, decision: "approved" | "rejected") => {
        const workItemId = data.items.find((i) => i.id === id)?.work_item_id
        if (workItemId === null || workItemId === undefined) return
        setBusy({ id, decision })
        setNotes((cur) => Object.fromEntries(Object.entries(cur).filter(([key]) => key !== id)))
        startTransition(async () => {
            const done = await decideWorkItem(workItemId, decision).catch(() => ({
                ok: false as const,
                error: t("err_unknown"),
            }))
            const note: ContentNote = done.ok
                ? { tone: "ok", text: t(decision === "approved" ? "queueApproved" : "queueRejected") }
                : { tone: "error", text: t("actionFailed", { error: done.error }) }
            setNotes((cur) => ({ ...cur, [id]: note }))
            if (done.ok) router.refresh()
            setBusy(null)
        })
    }
    const pillarNames = Object.fromEntries(data.pillars.map((p) => [p.id, p.name]))
    return (
        <ContentQueuePanelBase
            props={{
                t,
                waiting: data.items
                .filter((i) => i.status === "waiting_approval")
                .map((i) => ({ post: postView(t, i, pillarNames), quotes: quotes(i), hasDecision: i.work_item_id !== null })),
                ready: data.items.filter((i) => i.status === "approved").map((i) => postView(t, i, pillarNames)),
                canDecide: data.canManage,
                isPending,
                busy,
                notes,
            }}
            on={{ decide, open: focus.open }}
        />
    )
}
