"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { authActionsOf } from "@/hooks/auth"
import { useLocaleSwitch } from "@/hooks/locale"
import { useThemeSwitch } from "@/hooks/theme"
import { navigation } from "@/modules/i18n"
import {
    LEADS_ROUTE,
    OFFICE_ROUTE,
    ROLE_LABELS,
    accountEntriesOf,
    notificationsCopyOf,
    workspaceSection,
} from "./console.shared"
import { useConsoleShell } from "./useConsoleShell"
import { useCurrentConsoleSession } from "./useCurrentConsoleSession"
import { useSearchShortcut } from "./useSearchShortcut"
import { useSignOut } from "./useSignOut"
import { useSwitchWorkspace } from "./useSwitchWorkspace"
import { useWorkspaceLogo } from "./useWorkspaceLogo"

/** Everything the console top bar draws and does: the session, the counts, the language, the appearance and the search, worded. */
export const useConsoleHeader = () => {
    const session = useCurrentConsoleSession()
    const auth = authActionsOf()
    const shell = useConsoleShell(session.currentWorkspaceId)
    const t = useTranslations("shell")
    const tPromo = useTranslations("promo")
    const router = navigation.useRouter()
    const signOut = useSignOut(auth.endSession)
    const switchWorkspace = useSwitchWorkspace(session.currentWorkspaceId)
    const language = useLocaleSwitch()
    const theme = useThemeSwitch()
    const workspaceLogoUrl = useWorkspaceLogo()
    const [query, setQuery] = useState("")
    const [isNotificationsOpen, setNotificationsOpen] = useState(false)
    const [isSearchOpen, setSearchOpen] = useState(false)
    useSearchShortcut(() => setSearchOpen(true))

    const roleLabel = t(ROLE_LABELS[session.member.role])
    const workspaces = workspaceSection(
        session.workspaces,
        session.currentWorkspaceId,
        t("switchWorkspace"),
        switchWorkspace,
    )
    const accountEntries = accountEntriesOf({
        workspaces,
        accountLabel: t("navAccount"),
        accountDescription: `${session.userName} · ${session.email || t("signedIn")} · ${roleLabel}`,
        signOutLabel: t("signOut"),
        onSignOut: signOut.signOut,
    })
    return {
        props: {
            workspaceName: session.workspaceName,
            menuLabel: t("mainNavigation"),
            actionsLabel: t("headerActions"),
            workspaceLogoUrl,
            userName: session.userName,
            userId: session.member.userId,
            avatarUrl: session.avatarUrl,
            roleLabel,
            isFoundingMember: shell.isFoundingMember,
            foundingLabel: tPromo("foundingMember"),
            workspaceEntries: [workspaces],
            accountEntries,
            searchLabel: t("searchLeads"),
            searchPlaceholder: t("searchPlaceholder"),
            searchShortcut: t("searchShortcut"),
            closeLabel: t("closeSearch"),
            query,
            isSearchOpen,
            languageLabel: language.label,
            locale: language.locale,
            isLocalePending: language.isPending,
            localeOptions: language.options,
            themeLabel: t("themeLabel"),
            isDark: theme.isDark,
            pending: shell.pending,
            pendingCount: shell.pendingCount,
            isNotificationsOpen,
            notificationsCopy: notificationsCopyOf(t, shell.pendingCount),
        },
        on: {
            setQuery,
            setSearchOpen,
            search: (text: string) => {
                setSearchOpen(false)
                router.push(`${LEADS_ROUTE}?q=${encodeURIComponent(text)}`)
            },
            chooseLocale: language.choose,
            chooseDark: theme.choose,
            setNotificationsOpen,
            openOffice: () => {
                setNotificationsOpen(false)
                router.push(OFFICE_ROUTE)
            },
        },
    }
}
