"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    postView,
    quotes,
    useContentFocus,
    useContentItemActions,
    useContentCommand,
    type ContentNote,
    useContentData,
} from "@/hooks/content"
import { ContentQueuePanelBase } from "./component"

interface Deciding {
    readonly id: string
    readonly decision: "approved" | "rejected"
}

/** The Approvals tab: posts waiting for the owner (decided through the publish gate) and the approved ones ready to post. */
export const ContentQueuePanel = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const actions = useContentItemActions()
    const command = useContentCommand()
    const focus = useContentFocus()
    const [busy, setBusy] = useState<Deciding | null>(null)
    const [notes, setNotes] = useState<Readonly<Record<string, ContentNote>>>({})
    const decide = (id: string, decision: "approved" | "rejected") => {
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
                    setBusy(null)
                }
            },
            () =>
                setNotes((cur) => ({
                    ...cur,
                    [id]: { tone: "ok", text: t(decision === "approved" ? "queueApproved" : "queueRejected") },
                })),
        )
    }
    const pillarNames = Object.fromEntries(data.pillars.map((p) => [p.id, p.name]))
    return (
        <ContentQueuePanelBase
            props={{
                t,
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
            }}
            on={{ decide, open: focus.open }}
        />
    )
}
