"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { TeamPageHeading } from "@/modules/types"
import { TeamPageFrameBase } from "./component"

/** Which of the team's two pages is selected, its resolved heading and its routed owner content. */
interface TeamPageFrameProps {
    readonly selected: "members" | "permissions"
    readonly heading: TeamPageHeading
    readonly children: ReactNode
}

/** The team Page world owner keeps the same member capability and router actions; its Base draws the native tabs. */
export const TeamPageFrame = (props: TeamPageFrameProps) => {
    const t = useTranslations("permissions")
    const member = useMember()
    const router = navigation.useRouter()
    const open = (id: string) => {
        if (id === "members") router.push(CONSOLE_ROUTES.team)
        if (id === "permissions") router.push(CONSOLE_ROUTES.permissions)
    }
    return (
        <TeamPageFrameBase
            children={props.children}
            props={{
                heading: props.heading,
                selected: props.selected,
                canManage: isManager(member),
                tabsLabel: t("tabsLabel"),
                membersLabel: t("tabMembers"),
                permissionsLabel: t("tabPermissions"),
            }}
            on={{ select: open }}
        />
    )
}
