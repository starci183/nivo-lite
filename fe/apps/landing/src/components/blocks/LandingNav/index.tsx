"use client"

import { useTranslations } from "next-intl"
import { LANDING_ANCHORS } from "@/hooks/landing"
import { useLanguage } from "@/hooks/locale"
import { CONSOLE_PAGES, LANDING_ROUTES, appHref } from "@/modules/routes"
import { LandingNavBase } from "./component"

/** Where the anchors live; the reader's sign-in state is read in the browser. */
interface LandingNavProps {
    /** Prefix of the in-page anchors; "/" lets another page reach the landing anchors. */
    readonly anchorBase: string
}

/** The approved NIVO logo raster. */
const LOGO_SRC = "/brand/nivo-logo.png"

/** The landing top bar with its copy resolved; the language switch is wired here because it needs the browser. */
export const LandingNav = (props: LandingNavProps) => {
    const t = useTranslations("landing")
    const language = useLanguage()
    const anchor = (target: string): string => `${props.anchorBase}${target}`
    return (
        <LandingNavBase
            props={{
                homeHref: LANDING_ROUTES.home,
                homeLabel: t("homeLabel"),
                logoSrc: LOGO_SRC,
                navLabel: t("navLabel"),
                links: [
                    { id: "product", label: t("navProduct"), href: anchor(LANDING_ANCHORS.product) },
                    { id: "how", label: t("navHow"), href: anchor(LANDING_ANCHORS.how) },
                    { id: "founding", label: t("navFounding"), href: anchor(LANDING_ANCHORS.founding) },
                    { id: "faq", label: t("navFaq"), href: anchor(LANDING_ANCHORS.faq) },
                ],
                accountHref: appHref(CONSOLE_PAGES.login, language.locale),
                accountLabel: t("signIn"),
                tryHref: appHref(CONSOLE_PAGES.signup, language.locale),
                tryLabel: t("tryNow"),
                language: {
                    label: language.label,
                    locale: language.locale,
                    isPending: language.isPending,
                    options: language.options,
                },
            }}
            on={{ chooseLocale: language.choose }}
        />
    )
}
