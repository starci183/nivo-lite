"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useGuideBubbleShown, useGuideShortcut } from "@/hooks/guide"
import { useBrainTodoCount } from "@/hooks/knowledge"
import { navigation } from "@/modules/i18n"
import { GuideBubbleBase } from "./component"
import { GUIDE_IMAGE, GuideDrawer } from "./drawer-connected"

const ignore = () => undefined

/**
 * The guide: a floating button and a chat-style navigator drawer that searches the console locally (no AI tokens). Ctrl/Cmd+K opens it
 * from anywhere. The drawer, and the reads it searches, mount the first time it opens and stay mounted after. The guide shows the way
 * only; it never acts for the user. It is hidden until the member switches it on in the account menu, and then nothing floating is drawn.
 */
export const GuideBubble = () => {
    const t = useTranslations("guide")
    const pathname = navigation.usePathname()
    const todoCount = useBrainTodoCount()
    const [isOpen, setIsOpen] = useState(false)
    const [hasOpened, setHasOpened] = useState(false)
    const toggle = useCallback(() => {
        setIsOpen((open) => !open)
        setHasOpened(true)
    }, [])
    const close = useCallback(() => setIsOpen(false), [])
    const bubble = useGuideBubbleShown()
    useGuideShortcut(bubble.isShown ? toggle : ignore)
    const overComposer = pathname.endsWith("/brain") || pathname.endsWith("/chat") || /\/agents\/[^/]+/.test(pathname)

    if (!bubble.isShown) return null

    return (
        <>
            <GuideBubbleBase
                props={{
                    overComposer,
                    hasTodo: todoCount > 0,
                    label: isOpen ? t("close") : t("open"),
                    todoLabel: t("hasTodo"),
                    imageSrc: GUIDE_IMAGE,
                }}
                on={{ toggle }}
            />
            {hasOpened ? <GuideDrawer isOpen={isOpen} toggle={toggle} close={close} /> : null}
        </>
    )
}
