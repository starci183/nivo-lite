"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSignOut } from "@/hooks/auth"
import { useLocaleSwitch } from "@/hooks/locale"
import { useThemeSwitch } from "@/hooks/theme"
import { navigation } from "@/modules/i18n"
import { ADMIN_ROUTES } from "@/modules/routes"
import { useAdminSession } from "./useAdminSession"

/** One destination of the console bar. */
interface AdminHeaderDestination {
    id: string
    label: string
    href: string
    isCurrent: boolean
}

/** The view `useAdminHeader` returns. */
export interface AdminHeaderView {
    props: {
        title: string
        email: string
        accountDescription: string
        signOutLabel: string
        navigationLabel: string
        destinations: ReadonlyArray<AdminHeaderDestination>
        languageLabel: string
        locale: string
        isLocalePending: boolean
        localeOptions: ReadonlyArray<{ value: string; label: string; name: string }>
        themeLabel: string
        isDark: boolean
        openMenuLabel: string
        closeMenuLabel: string
        isMenuOpen: boolean
    }
    on: {
        chooseLocale: (locale: string) => void
        chooseDark: (isDark: boolean) => void
        signOut: () => void
        setMenuOpen: (isOpen: boolean) => void
    }
}

/**
 * Everything the console bar draws and does: the admin the back end knows the caller as (anyone it does not know as one gets a 404 for the whole
 * console, so it is not discoverable), the destinations with the open one marked, the language, the appearance and sign out.
 */
export const useAdminHeader = (): AdminHeaderView => {
    const t = useTranslations("admin")
    const ts = useTranslations("shell")
    const session = useAdminSession()
    const pathname = navigation.usePathname()
    const language = useLocaleSwitch()
    const theme = useThemeSwitch()
    const signOut = useSignOut()
    const [isMenuOpen, setMenuOpen] = useState(false)
    if (session.isMissing) notFound()
    return {
        props: {
            title: t("consoleTitle"),
            email: session.email ?? "",
            accountDescription: t("accountDescription"),
            signOutLabel: ts("signOut"),
            navigationLabel: t("consoleTitle"),
            destinations: [
                {
                    id: "workspaces",
                    label: t("navWorkspaces"),
                    href: ADMIN_ROUTES.workspaces,
                    isCurrent: pathname !== ADMIN_ROUTES.health,
                },
                {
                    id: "health",
                    label: t("navHealth"),
                    href: ADMIN_ROUTES.health,
                    isCurrent: pathname === ADMIN_ROUTES.health,
                },
            ],
            languageLabel: language.label,
            locale: language.locale,
            isLocalePending: language.isPending,
            localeOptions: language.options,
            themeLabel: ts("themeLabel"),
            isDark: theme.isDark,
            openMenuLabel: ts("openMenu"),
            closeMenuLabel: ts("closeMenu"),
            isMenuOpen,
        },
        on: {
            chooseLocale: language.choose,
            chooseDark: theme.choose,
            signOut: signOut.signOut,
            setMenuOpen,
        },
    }
}
