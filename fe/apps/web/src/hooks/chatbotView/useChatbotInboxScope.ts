"use client"

import { useState, useTransition } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import type { InboxView } from "./useChatbotInbox"

/** Drafts stay with their real conversation or escalation throughout one mounted inbox scope. */
type InboxDrafts = Readonly<Record<string, string>>

/** Owns the inbox's formerly mounted local pane/draft lifetime, apart from durable delivery state. */
export const useChatbotInboxScope = (isActive: boolean, scope: string) => {
    const [view, setView] = useState<InboxView>({ pane: undefined, isInfoOpen: false, pickedId: null })
    const [replyDrafts, setReplyDrafts] = useState<InboxDrafts>({})
    const [answerDrafts, setAnswerDrafts] = useState<InboxDrafts>({})
    const [isNavigating, startNavigation] = useTransition()
    const lifetime = useFeatureLifetime(isActive, scope)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setView({ pane: undefined, isInfoOpen: false, pickedId: null })
            setReplyDrafts({})
            setAnswerDrafts({})
        },
    })
    return {
        view,
        setView,
        replyDrafts,
        setReplyDrafts,
        answerDrafts,
        setAnswerDrafts,
        isNavigating,
        startNavigation,
        lifetime,
    }
}
