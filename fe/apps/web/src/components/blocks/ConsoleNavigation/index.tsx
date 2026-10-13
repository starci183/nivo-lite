"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { useConsoleNav, useConsoleShell } from "@/hooks/console"
import { ConsoleNavigationBase } from "./component"

/** The role and the workspace the rail reads its count for. */
type ConsoleNavigationProps = {
    readonly role: "owner" | "manager" | "staff"
    readonly workspaceId: string
}

/** The connected wide rail: destinations by role, the current route highlighted and the pending count on the Office. */
export const ConsoleNavigation = (props: ConsoleNavigationProps) => {
    const t = useTranslations("shell")
    const router = navigation.useRouter()
    const { pendingCount } = useConsoleShell(props.workspaceId)
    const items = useConsoleNav(props.role, pendingCount)
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
