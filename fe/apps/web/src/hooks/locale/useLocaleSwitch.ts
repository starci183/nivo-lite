"use client"

import { useLocale, useTranslations } from "next-intl"
import { LOCALE_COOKIE, appLocaleOf, navigation } from "@/modules/i18n"
import { useTransition } from "react"

const YEAR_SECONDS = 60 * 60 * 24 * 365

/** One language the switch offers: its code, short mark and spoken name. */
type LocaleOption = {
    readonly value: string
    readonly label: string
    readonly name: string
}

/** What a language switch needs: the words, the current language, whether a change runs and the command that makes one. */
type LocaleChoice = {
    readonly label: string
    readonly locale: string
    readonly options: ReadonlyArray<LocaleOption>
    readonly isPending: boolean
    readonly choose: (next: string) => void
}

/** Stores the reader's language in the cookie and re-renders every route; the URL never carries the language. */
export const useLocaleSwitch = (): LocaleChoice => {
    const t = useTranslations("shell")
    const locale = useLocale()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    return {
        label: t("languageLabel"),
        locale,
        options: [
            { value: "vi", label: t("localeShortVi"), name: t("localeNameVi") },
            { value: "en", label: t("localeShortEn"), name: t("localeNameEn") },
        ],
        isPending,
        choose: (next) => {
            if (next === locale) return
            startTransition(() => {
                // The reader's language lives in a cookie the server reads; the URL never carries it.
                document.cookie = `${LOCALE_COOKIE}=${appLocaleOf(next)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`
                router.refresh()
            })
        },
    }
}
