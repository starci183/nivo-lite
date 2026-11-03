"use client"

import { useTranslations } from "next-intl"
import { useState, type Dispatch, type SetStateAction } from "react"
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
import type { DropdownMenuSection, DropdownMenuEntry } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"

/** The view `useConsoleHeader` returns. */
export interface ConsoleHeaderView {
    props: {
        workspaceName: string
        actionsLabel: string
        workspaceLogoUrl: string | null
        userName: string
        userId: string
        avatarUrl: string | undefined
        roleLabel: string
        isFoundingMember: boolean
        foundingLabel: string
        workspaceEntries: DropdownMenuSection[]
        accountEntries: readonly DropdownMenuEntry[]
        searchLabel: string
        searchPlaceholder: string
        searchShortcut: string
        closeLabel: string
        query: string
        isSearchOpen: boolean
        languageLabel: string
        locale: string
        isLocalePending: boolean
        localeOptions: readonly {
            readonly value: string
            readonly label: string
            readonly name: string
        }[]
        themeLabel: string
        isDark: boolean
        pending: readonly ConsolePending[]
        pendingCount: number
        isNotificationsOpen: boolean
        notificationsCopy: {
            bell: string
            title: string
            nothingWaiting: string
            openOffice: string
        }
    }
    on: {
        setQuery: Dispatch<SetStateAction<string>>
        setSearchOpen: Dispatch<SetStateAction<boolean>>
        search: (text: string) => void
        chooseLocale: (next: string) => void
        chooseDark: (isDark: boolean) => void
        setNotificationsOpen: Dispatch<SetStateAction<boolean>>
        openOffice: () => void
    }
}

/** Everything the console top bar draws and does: the session, the counts, the language, the appearance and the search, worded. */
export const useConsoleHeader = (): ConsoleHeaderView => {
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
        profile: { label: t("profile"), description: t("profileDescription") },
        accountLabel: session.userName,
        accountDescription: `${session.email || t("signedIn")} · ${roleLabel}`,
        signOutLabel: t("signOut"),
        onSignOut: signOut.signOut,
    })
    return {
        props: {
            workspaceName: session.workspaceName,
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
