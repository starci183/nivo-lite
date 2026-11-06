"use client"

import { useTranslations } from "next-intl"
import { useConsoleNav, useCurrentConsoleSession } from "@/hooks/console"
import { useLocaleSwitch } from "@/hooks/locale"
import { useThemeSwitch } from "@/hooks/theme"
import { navigation } from "@/modules/i18n"
import { ConsoleDrawerContentBase } from "./component"

/** The connected drawer body: the rail's destinations with language and appearance. */
export const ConsoleDrawerContent = () => {
    const session = useCurrentConsoleSession()
    const t = useTranslations("shell")
    const router = navigation.useRouter()
    const items = useConsoleNav(session.member.role)
    const language = useLocaleSwitch()
    const theme = useThemeSwitch()
    return (
        <ConsoleDrawerContentBase
            props={{
                items,
                label: t("mainNavigation"),
                groupLabels: { operate: t("groupOperate"), setup: t("groupSetup") },
                languageLabel: language.label,
                locale: language.locale,
                isLocalePending: language.isPending,
                localeOptions: language.options,
                themeLabel: t("themeLabel"),
                isDark: theme.isDark,
            }}
            on={{
                go: router.push,
                chooseLocale: language.choose,
                chooseDark: theme.choose,
            }}
        />
    )
}
