"use client"

import { useTranslations } from "next-intl"
import { useBrainTodoCount } from "@/hooks/knowledge"
import { useQueryChatUnreadSwr, useQueryProviderSandboxSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { pathInWorkspace, workspaceHref } from "@/modules/routes"
import type { ConsoleNavItem } from "@/modules/types"
import { DESTINATIONS, activeDestinationKey } from "./console.shared"

/** The number a destination wears in the rail: the Second Brain what needs the owner, the team chat what is unread. */
const badgeOf = (key: string, brainCount: number, chatUnread: number): number => {
    if (key === "brain") return brainCount
    return key === "chat" ? chatUnread : 0
}

/** The rail destinations this role may see, translated, with the current route highlighted and the Second Brain badge counted. */
export const useConsoleNav = (role: "owner" | "manager" | "staff"): ReadonlyArray<ConsoleNavItem> => {
    const t = useTranslations("shell")
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const activeKey = activeDestinationKey(pathInWorkspace(pathname))
    const brainCount = useBrainTodoCount()
    const chatUnread = useQueryChatUnreadSwr(workspaceId).data?.total ?? 0
    const hasSandbox = useQueryProviderSandboxSwr(role !== "staff").data?.enabled === true
    return DESTINATIONS.filter(
        (d) => (!d.managerOnly || role !== "staff") && (d.sandboxOnly !== true || hasSandbox),
    ).map((d) => ({
        id: d.key,
        label: t(d.label),
        href: workspaceHref(workspaceId, d.route),
        icon: d.icon,
        group: d.group,
        isActive: d.key === activeKey,
        badge: badgeOf(d.key, brainCount, chatUnread),
    }))
}
