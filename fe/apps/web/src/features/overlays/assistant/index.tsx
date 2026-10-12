"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useGuideSpotlight } from "@/hooks/guide"
import { askGuide } from "@/lib/guide/actions"
import { pageAt } from "@/lib/guide/sitemap"
import type { GuideReply, GuideTurn } from "@/lib/guide/types"
import { navigation } from "@/modules/i18n"
import { GuideBubbleBase } from "./component"

/** Who is asking: owners and managers see setup suggestions, staff see their own. */
interface GuideBubbleProps {
    readonly isManager: boolean
}

/** One line of the conversation: the member question or the guide reply. */
type GuideMessage =
    | { readonly id: number; readonly role: "user"; readonly text: string }
    | { readonly id: number; readonly role: "guide"; readonly reply: GuideReply }

const PHONE_WIDTH = 640

/** The turns the model sees, from the conversation so far. */
const historyOf = (messages: ReadonlyArray<GuideMessage>): Array<GuideTurn> =>
    messages.map((message) =>
        message.role === "user" ? { role: "user", text: message.text } : { role: "guide", text: message.reply.answer },
    )

/** The guide: the conversation lives here, the drawing in the pure half. The guide shows the way only; it never acts for the user. */
export const GuideBubble = (props: GuideBubbleProps) => {
    const t = useTranslations("guide")
    const map = useTranslations("guideMap")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const spotlight = useGuideSpotlight(pathname)
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<ReadonlyArray<GuideMessage>>([])
    const [question, setQuestion] = useState("")
    const [isPending, startTransition] = useTransition()
    const here = pageAt(pathname)

    const send = (text: string) => {
        const asked = text.trim()
        if (asked === "" || isPending) return
        const history = historyOf(messages)
        const id = Date.now()
        setMessages((current) => [...current, { id, role: "user", text: asked }])
        setQuestion("")
        startTransition(async () => {
            const reply = await askGuide({ question: asked, path: pathname, history }).catch((): GuideReply => ({
                answer: t("failed"),
                steps: [],
                links: [],
                source: "busy",
            }))
            setMessages((current) => [...current, { id: id + 1, role: "guide", reply }])
        })
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
    const suggestions = props.isManager
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
                isThinking: isPending,
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
                restart: () => setMessages([]),
            }}
        />
    )
}
