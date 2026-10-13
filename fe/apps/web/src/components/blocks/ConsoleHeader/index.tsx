"use client"

import { useTranslations } from "next-intl"
import { useAuthActions } from "@/hooks/auth"
import { navigation } from "@/modules/i18n"
import { useState } from "react"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import {
    LEADS_ROUTE,
    OFFICE_ROUTE,
    ROLE_LABELS,
    useConsoleShell,
    useSignOut,
    useSwitchWorkspace,
    workspaceEntries,
} from "@/hooks/console"
import { useLocaleSwitch } from "@/hooks/locale"
import type { ConsoleWorkspace } from "@/modules/types"
import { ConsoleHeaderBase } from "./component"

/** What the console layout reads for the top bar: plain session facts and the real counts. */
type ConsoleHeaderProps = {
    readonly workspaceName: string
    readonly userName: string
    readonly email: string
    readonly avatarUrl: string | null
    readonly role: "owner" | "manager" | "staff"
    readonly workspaces: ReadonlyArray<ConsoleWorkspace>
    readonly currentWorkspaceId: string
}

/** The connected console top bar: workspace, search, New menu, language, notifications and the account menu. */
export const ConsoleHeader = (props: ConsoleHeaderProps) => {
    const auth = useAuthActions()
    const shell = useConsoleShell(props.currentWorkspaceId)
    const t = useTranslations("shell")
    const tPromo = useTranslations("promo")
    const router = navigation.useRouter()
    const signOut = useSignOut(auth.endSession)
    const switchWorkspace = useSwitchWorkspace(props.currentWorkspaceId)
    const language = useLocaleSwitch()
    const [query, setQuery] = useState("")
    const [isNotificationsOpen, setNotificationsOpen] = useState(false)
    const roleLabel = t(ROLE_LABELS[props.role])
    const workspaces = workspaceEntries(props.workspaces, props.currentWorkspaceId, switchWorkspace)
    const accountEntries: ReadonlyArray<DropdownMenuEntry> = [
        { kind: "section", id: "workspaces", label: t("switchWorkspace"), items: workspaces },
        {
            kind: "section",
            id: "account",
            label: props.userName,
            items: [
                { id: "role", label: `${props.userName} · ${roleLabel}`, isDisabled: true },
                { id: "email", label: props.email || t("signedIn"), isDisabled: true },
                { id: "account", label: t("navAccount"), href: "/account" },
                { id: "signout", label: t("signOut"), onAction: signOut.signOut },
            ],
        },
    ]
    const newEntries: ReadonlyArray<DropdownMenuEntry> = [
        { id: "new-lead", label: t("newLead"), href: `${LEADS_ROUTE}?new=1` },
        { id: "add-module", label: t("addModule"), href: "/agents" },
        shell.chatbotAgentId
            ? { id: "test-chatbot", label: t("testChatbot"), href: `/modules/${shell.chatbotAgentId}/chat` }
            : { id: "buy-chatbot", label: t("buyChatbot"), href: "/modules/new?module=chatbot" },
    ]
    return (
        <ConsoleHeaderBase
            props={{
                logoLabel: t("brandLogo"),
                workspaceName: props.workspaceName,
                userName: props.userName,
                avatarUrl: props.avatarUrl ?? undefined,
                roleLabel,
                isStaff: props.role === "staff",
                isFoundingMember: shell.isFoundingMember,
                foundingLabel: tPromo("foundingMember"),
                workspaceEntries: workspaces,
                accountEntries,
                newEntries,
                searchLabel: t("searchLeads"),
                searchPlaceholder: t("searchPlaceholder"),
                query,
                newLabel: t("newLabel"),
                languageLabel: language.label,
                locale: language.locale,
                isLocalePending: language.isPending,
                localeOptions: language.options,
                pending: shell.pending,
                pendingCount: shell.pendingCount,
                isNotificationsOpen,
                notificationsCopy: {
                    bell: t("notifications"),
                    title:
                        shell.pendingCount === 0
                            ? t("notifications")
                            : t("pendingTitle", { count: shell.pendingCount }),
                    nothingWaiting: t("nothingWaiting"),
                    openOffice: t("openOffice"),
                },
            }}
            on={{
                setQuery,
                search: (text) => router.push(`${LEADS_ROUTE}?q=${encodeURIComponent(text)}`),
                chooseLocale: language.choose,
                setNotificationsOpen,
                openOffice: () => {
                    setNotificationsOpen(false)
                    router.push(OFFICE_ROUTE)
                },
            }}
        />
    )
}
