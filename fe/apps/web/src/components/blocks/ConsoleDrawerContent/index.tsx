"use client"

import { useTranslations } from "next-intl"
import { useConsoleNav, useConsoleShell, useCurrentConsoleSession } from "@/hooks/console"
import { useLocaleSwitch } from "@/hooks/locale"
import { useThemeSwitch } from "@/hooks/theme"
import { navigation } from "@/modules/i18n"
import { ConsoleDrawerContentBase } from "./component"

/** What the drawer body reports besides its own commands. */
interface ConsoleDrawerContentProps {
    /** Called after a destination is chosen, so the drawer can close. */
    readonly onNavigate: () => void
}

/** The connected drawer body: the rail's destinations with language and appearance. */
export const ConsoleDrawerContent = (props: ConsoleDrawerContentProps) => {
    const session = useCurrentConsoleSession()
    const t = useTranslations("shell")
    const router = navigation.useRouter()
    const { pendingCount } = useConsoleShell(session.currentWorkspaceId)
    const items = useConsoleNav(session.member.role, pendingCount)
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
                go: (href) => {
                    props.onNavigate()
                    router.push(href)
                },
                chooseLocale: language.choose,
                chooseDark: theme.choose,
            }}
        />
    )
}
