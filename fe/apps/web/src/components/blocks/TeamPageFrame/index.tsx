"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import type { PageHeaderContent } from "@starci/grammar/common"
import { isManager, useMember } from "@/hooks/member"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { TeamPageFrameBase } from "./component"

/** Which of the two views the page shows, its header and its body. */
interface TeamPageFrameProps {
    readonly selected: "members" | "permissions"
    /** The header without its tabs. */
    readonly header: PageHeaderContent
    readonly children: ReactNode
}

/** The page of the team: the tabs on its header band; only owner and manager see them (both pages are theirs). */
export const TeamPageFrame = (props: TeamPageFrameProps) => {
    const t = useTranslations("permissions")
    const member = useMember()
    const router = navigation.useRouter()
    const open = (id: string) => {
        if (id === "members") router.push(CONSOLE_ROUTES.team)
        if (id === "permissions") router.push(CONSOLE_ROUTES.permissions)
    }
    const header: PageHeaderContent = isManager(member)
        ? {
              ...props.header,
              tabs: {
                  label: t("tabsLabel"),
                  selectedKey: props.selected,
                  labelVisibility: "always",
                  items: [
                      { id: "members", label: t("tabMembers") },
                      { id: "permissions", label: t("tabPermissions") },
                  ],
                  onSelect: open,
              },
          }
        : props.header
    return <TeamPageFrameBase shape={{ body: props.children }} props={{ header }} />
}
