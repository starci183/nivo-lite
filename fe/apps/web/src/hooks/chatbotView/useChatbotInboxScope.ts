"use client"

import { useState, useTransition, type Dispatch, type SetStateAction, type TransitionStartFunction } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import type { InboxView } from "./useChatbotInbox"

/** Drafts stay with their real conversation or escalation throughout one mounted inbox scope. */
type InboxDrafts = Readonly<Record<string, string>>

/** The view `useChatbotInboxScope` returns. */
export interface ChatbotInboxScopeView {
    view: InboxView
    setView: Dispatch<SetStateAction<InboxView>>
    replyDrafts: Readonly<Record<string, string>>
    setReplyDrafts: Dispatch<SetStateAction<Readonly<Record<string, string>>>>
    answerDrafts: Readonly<Record<string, string>>
    setAnswerDrafts: Dispatch<SetStateAction<Readonly<Record<string, string>>>>
    isNavigating: boolean
    startNavigation: TransitionStartFunction
    lifetime: {
        identity: { readonly isActive: boolean; readonly scope: string }
        capture: () => () => boolean
    }
}

/** Owns the inbox's formerly mounted local pane/draft lifetime, apart from durable delivery state. */
export const useChatbotInboxScope = (isActive: boolean, scope: string): ChatbotInboxScopeView => {
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
