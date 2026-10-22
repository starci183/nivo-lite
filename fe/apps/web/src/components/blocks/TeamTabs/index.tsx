"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { TeamTabsBase } from "./component"

/** Which of the two views the page shows. */
interface TeamTabsProps {
    readonly selected: "members" | "permissions"
}

/** The tabs over the team and the permissions pages; only owner and manager see them (both pages are theirs). */
export const TeamTabs = (props: TeamTabsProps) => {
    const t = useTranslations("permissions")
    const member = useMember()
    const router = navigation.useRouter()
    if (!isManager(member)) return null
    const open = (id: string) => {
        if (id === "members") router.push(CONSOLE_ROUTES.team)
        if (id === "permissions") router.push(CONSOLE_ROUTES.permissions)
    }
    return (
        <TeamTabsBase
            props={{
                label: t("tabsLabel"),
                tabs: [
                    { id: "members", label: t("tabMembers") },
                    { id: "permissions", label: t("tabPermissions") },
                ],
                selected: props.selected,
            }}
            on={{ select: open }}
        />
    )
}
