"use client"

import { useTranslations } from "next-intl"
import { authActionsOf } from "@/hooks/auth"
import { useQueryInboxLeadsSwr } from "@/hooks/swr"
import { useGuideBubbleShown } from "@/hooks/guide"
import { useLocaleSwitch } from "@/hooks/locale"
import { useThemeSwitch } from "@/hooks/theme"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ROLE_LABELS, accountEntriesOf, workspaceSection } from "./console.shared"
import { useConsoleShell } from "./useConsoleShell"
import { useCurrentConsoleSession } from "./useCurrentConsoleSession"
import { useSignOut } from "./useSignOut"
import { useSwitchWorkspace } from "./useSwitchWorkspace"
import { useWorkspaceLogo } from "./useWorkspaceLogo"
import type { DropdownMenuSection, DropdownMenuEntry } from "@starci/grammar/common"

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
        languageLabel: string
        locale: string
        isLocalePending: boolean
        localeOptions: readonly {
            readonly value: string
            readonly label: string
            readonly name: string
        }[]
        themeLabel: string
        guideBubbleLabel: string
        guideBubbleDescription: string
        isGuideBubbleShown: boolean
        isDark: boolean
        bellLabel: string
        bellHref: string
        hasWaiting: boolean
    }
    on: {
        chooseLocale: (next: string) => void
        chooseDark: (isDark: boolean) => void
        chooseGuideBubble: (shown: boolean) => void
    }
}

/** Everything the console top bar draws and does: the session, the counts, the language, the appearance and the notifications, worded. */
export const useConsoleHeader = (): ConsoleHeaderView => {
    const session = useCurrentConsoleSession()
    const auth = authActionsOf()
    const shell = useConsoleShell(session.currentWorkspaceId)
    const t = useTranslations("shell")
    const tPromo = useTranslations("promo")
    const signOut = useSignOut(auth.endSession)
    const switchWorkspace = useSwitchWorkspace(session.currentWorkspaceId)
    const language = useLocaleSwitch()
    const theme = useThemeSwitch()
    const guideBubble = useGuideBubbleShown()
    const workspaceLogoUrl = useWorkspaceLogo()
    const waitingCount =
        useQueryInboxLeadsSwr(session.currentWorkspaceId, { tab: "needs_you", sort: "recent", limit: 1 }).data?.counts
            .needsYou ?? 0

    const roleLabel = t(ROLE_LABELS[session.member.role])
    const workspaces = workspaceSection(
        session.workspaces,
        session.currentWorkspaceId,
        t("switchWorkspace"),
        switchWorkspace,
    )
    const accountEntries = accountEntriesOf({
        workspaceId: session.currentWorkspaceId,
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
            languageLabel: language.label,
            locale: language.locale,
            isLocalePending: language.isPending,
            localeOptions: language.options,
            themeLabel: t("themeLabel"),
            guideBubbleLabel: t("guideBubbleLabel"),
            guideBubbleDescription: t("guideBubbleDescription"),
            isGuideBubbleShown: guideBubble.isShown,
            isDark: theme.isDark,
            bellLabel: t("bellLabel"),
            bellHref: workspaceHref(session.currentWorkspaceId, CONSOLE_ROUTES.inbox),
            hasWaiting: waitingCount > 0,
        },
        on: {
            chooseLocale: language.choose,
            chooseDark: theme.choose,
            chooseGuideBubble: guideBubble.setShown,
        },
    }
}
