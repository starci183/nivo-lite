"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { ADMIN_ROUTES } from "@/modules/routes"
import { AdminNavigationBase } from "./component"

/** The connected console bar: workspaces and platform health, the open one marked. */
export const AdminNavigation = () => {
    const t = useTranslations("admin")
    const pathname = navigation.usePathname()
    return (
        <AdminNavigationBase
            props={{
                label: t("consoleTitle"),
                items: [
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
            }}
        />
    )
}
