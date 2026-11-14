"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { LANDING_ANCHORS } from "@/hooks/landing"
import { useLanguage } from "@/hooks/locale"
import { CONSOLE_PAGES, appHref } from "@/modules/routes"
import { LandingNavDrawerBase } from "./component"

/** Where the anchors live. */
interface LandingNavDrawerProps {
    /** Prefix of the in-page anchors; "/" lets another page reach the landing anchors. */
    readonly anchorBase: string
}

/** The navigation drawer of the top bar, with its words resolved and its open state held here. */
export const LandingNavDrawer = (props: LandingNavDrawerProps) => {
    const t = useTranslations("landing")
    const language = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const anchor = (target: string): string => `${props.anchorBase}${target}`
    return (
        <LandingNavDrawerBase
            props={{
                title: t("menuTitle"),
                openLabel: t("menuOpen"),
                closeLabel: t("menuClose"),
                isOpen,
                links: [
                    { id: "product", label: t("navProduct"), href: anchor(LANDING_ANCHORS.product) },
                    { id: "how", label: t("navHow"), href: anchor(LANDING_ANCHORS.how) },
                    { id: "founding", label: t("navFounding"), href: anchor(LANDING_ANCHORS.founding) },
                    { id: "faq", label: t("navFaq"), href: anchor(LANDING_ANCHORS.faq) },
                ],
                accountHref: appHref(CONSOLE_PAGES.login, language.locale),
                accountLabel: t("signIn"),
                language: { label: language.label, locale: language.locale, options: language.options },
            }}
            on={{ setOpen: setIsOpen, chooseLocale: language.choose }}
        />
    )
}
