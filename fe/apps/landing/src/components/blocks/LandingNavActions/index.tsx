"use client"

import { useTranslations } from "next-intl"
import { useLanguage } from "@/hooks/locale"
import { CONSOLE_PAGES, appHref } from "@/modules/routes"
import { LandingNavActionsBase } from "./component"

/** The language switch and the sign-in and try actions; the switch is wired here because it needs the browser. */
export const LandingNavActions = () => {
    const t = useTranslations("landing")
    const language = useLanguage()
    return (
        <LandingNavActionsBase
            props={{
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
