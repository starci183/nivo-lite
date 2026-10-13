"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { useConsoleNav, useConsoleShell, useCurrentConsoleSession } from "@/hooks/console"
import { ConsoleNavigationBase } from "./component"

/** The connected wide rail: destinations by role, the current route highlighted and the pending count on the Office. */
export const ConsoleNavigation = () => {
    const session = useCurrentConsoleSession()
    const t = useTranslations("shell")
    const router = navigation.useRouter()
    const { pendingCount } = useConsoleShell(session.currentWorkspaceId)
    const items = useConsoleNav(session.member.role, pendingCount)
    return (
        <ConsoleNavigationBase
            props={{
                items,
                label: t("mainNavigation"),
                groupLabels: { operate: t("groupOperate"), setup: t("groupSetup") },
            }}
            on={{ go: (href) => router.push(href) }}
        />
    )
}
