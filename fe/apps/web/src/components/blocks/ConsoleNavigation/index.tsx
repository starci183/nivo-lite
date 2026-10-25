"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { useConsoleNav, useConsoleShell, useCurrentConsoleSession, useRailCollapsed } from "@/hooks/console"
import { ConsoleNavigationBase } from "./component"

/** The connected wide rail: destinations by role, the current route highlighted, the pending count on the Office and a per-person collapse. */
export const ConsoleNavigation = () => {
    const session = useCurrentConsoleSession()
    const t = useTranslations("shell")
    const router = navigation.useRouter()
    const { pendingCount } = useConsoleShell(session.currentWorkspaceId)
    const items = useConsoleNav(session.member.role, pendingCount)
    const rail = useRailCollapsed(session.member.userId)
    return (
        <ConsoleNavigationBase
            props={{
                items,
                label: t("mainNavigation"),
                groupLabels: { operate: t("groupOperate"), setup: t("groupSetup") },
                isCollapsed: rail.isCollapsed,
                collapseLabel: t("collapseRail"),
                expandLabel: t("expandRail"),
            }}
            on={{ go: (href) => router.push(href), setCollapsed: rail.setCollapsed }}
        />
    )
}
