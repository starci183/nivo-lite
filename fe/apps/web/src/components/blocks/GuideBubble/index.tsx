"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useGuideConversation, useGuideSpotlight, pageAt } from "@/hooks/guide"

import { isManager, useMember } from "@/hooks/member"

import { navigation } from "@/modules/i18n"
import { GuideBubbleBase } from "./component"

const PHONE_WIDTH = 640

/**
 * The guide: the conversation lives here, the drawing in the pure half. The guide shows the way only; it never acts for the user.
 * Owners and managers see setup suggestions, staff see their own.
 */
export const GuideBubble = () => {
    const isManagerRole = isManager(useMember())
    const t = useTranslations("guide")
    const map = useTranslations("guideMap")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const spotlight = useGuideSpotlight(pathname)
    const [isOpen, setIsOpen] = useState(false)
    const { messages, isAsking, ask, restart } = useGuideConversation(isManagerRole)
    const [question, setQuestion] = useState("")
    const here = pageAt(pathname)

    const send = (text: string) => {
        if (text.trim() === "" || isAsking) return
        setQuestion("")
        void ask(text, pathname)
    }
    const go = (messageId: number, linkId: string) => {
        const message = messages.find((entry) => entry.id === messageId)
        const link =
            message?.role === "guide" ? message.reply.links.find((entry) => entry.pageId === linkId) : undefined
        if (link === undefined) return
        spotlight(link.target, pathname === link.href)
        if (window.innerWidth < PHONE_WIDTH) setIsOpen(false)
        if (pathname !== link.href) router.push(link.href)
    }
    const suggestions = isManagerRole
        ? [t("suggestSepay"), t("suggestTelegram"), t("suggestTeam"), t("suggestKnowledge")]
        : [t("suggestLeads"), t("suggestOffice"), t("suggestAccount")]

    return (
        <GuideBubbleBase
            props={{
                isOpen,
                openLabel: t("open"),
                closeLabel: t("close"),
                title: t("title"),
                subtitle: here === undefined ? t("subtitle") : t("here", { page: map(`${here.id}.title`) }),
                greeting: t("greeting"),
                stepsLabel: t("steps"),
                thinking: t("thinking"),
                isThinking: isAsking,
                messages: messages.map((message) =>
                    message.role === "user"
                        ? { id: message.id, isUser: true, text: message.text, steps: [], links: [], note: null }
                        : {
                              id: message.id,
                              isUser: false,
                              text: message.reply.answer,
                              steps: message.reply.steps,
                              links: message.reply.links.map((link) => ({ id: link.pageId, label: link.label })),
                              note: message.reply.source === "ai" ? t("aiNote") : null,
                          },
                ),
                suggestions,
                question,
                questionLabel: t("questionLabel"),
                placeholder: t("placeholder"),
                sendLabel: t("send"),
                restartLabel: t("restart"),
            }}
            on={{
                toggle: () => setIsOpen((open) => !open),
                changeQuestion: setQuestion,
                send: () => send(question),
                ask: send,
                go,
                restart,
            }}
        />
    )
}
