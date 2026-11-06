"use client"

import { useTranslations } from "next-intl"
import { useBrainTodoCount } from "@/hooks/brain"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { pathInWorkspace, workspaceHref } from "@/modules/routes"
import type { ConsoleNavItem } from "@/modules/types"
import { DESTINATIONS, activeDestinationKey } from "./console.shared"

/** The number a destination wears in the rail: the Office its waiting approvals, the Second Brain what needs the owner. */
const badgeOf = (key: string, pendingCount: number, brainCount: number): number => {
    if (key === "brain") return brainCount
    return key === "chat" ? pendingCount : 0
}

/** The rail destinations this role may see, translated, with the current route highlighted and the Office and Second Brain badges counted. */
export const useConsoleNav = (
    role: "owner" | "manager" | "staff",
    pendingCount: number,
): ReadonlyArray<ConsoleNavItem> => {
    const t = useTranslations("shell")
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const activeKey = activeDestinationKey(pathInWorkspace(pathname))
    const brainCount = useBrainTodoCount()
    return DESTINATIONS.filter((d) => !d.managerOnly || role !== "staff").map((d) => ({
        id: d.key,
        label: t(d.label),
        href: workspaceHref(workspaceId, d.route),
        icon: d.icon,
        group: d.group,
        isActive: d.key === activeKey,
        badge: badgeOf(d.key, pendingCount, brainCount),
    }))
}
