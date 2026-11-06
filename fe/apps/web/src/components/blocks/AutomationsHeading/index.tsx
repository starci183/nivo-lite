"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useActiveWorkspace, useWorkspaceCards, useWorkspaceId } from "@/hooks/workspaces"
import { APP_ROUTES, AUTOMATION_ROUTES, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { AutomationsHeadingBase } from "./component"

/** The body the page draws under the heading. */
type AutomationsHeadingProps = {
    readonly children: ReactNode
}

/** The Automations page frame with the words of the automations catalog; the meta line is the active workspace name. */
export const AutomationsHeading = (props: AutomationsHeadingProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("automations")
    const { activeWorkspaceId } = useActiveWorkspace()
    const { cards, status } = useWorkspaceCards()
    const workspaceName = cards.find((card) => card.id === activeWorkspaceId)?.name
    return (
        <AutomationsHeadingBase
            children={props.children}
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, APP_ROUTES.dashboard) },
                    { id: "automations", label: t("title") },
                ],
                ...(workspaceName === undefined ? {} : { workspace: workspaceName }),
                title: t("title"),
                leadBefore: t("leadBefore"),
                leadLink: t("leadLink"),
                leadHref: workspaceHref(workspaceId, CONSOLE_ROUTES.authority),
                leadAfter: t("leadAfter"),
                advancedLabel: t("advancedShort"),
                advancedHref: workspaceHref(workspaceId, AUTOMATION_ROUTES.developers),
                isLoading: status === "loading",
            }}
        />
    )
}
