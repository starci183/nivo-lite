import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { LOCALE_COOKIE, appLocaleOf, navigation } from "@/modules/i18n"

type UseLanguageResult = {
    label: string
    locale: string
    isPending: boolean
    choose: (next: string) => void
    options: {
        value: string
        label: string
        name: string
    }[]
}

/** The reader's language as the landing offers it: the words of the switch, the current language and the command that changes it. */
export const useLanguage = (): UseLanguageResult => {
    const t = useTranslations("shell")
    const locale = useLocale()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const choose = (next: string): void => {
        if (next === locale) return
        document.cookie = `${LOCALE_COOKIE}=${appLocaleOf(next)}; path=/; max-age=31536000; samesite=lax`
        startTransition(() => router.refresh())
    }
    return {
        label: t("languageLabel"),
        locale,
        isPending,
        choose,
        options: [
            { value: "vi", label: t("localeShortVi"), name: t("localeNameVi") },
            { value: "en", label: t("localeShortEn"), name: t("localeNameEn") },
        ],
    }
}
