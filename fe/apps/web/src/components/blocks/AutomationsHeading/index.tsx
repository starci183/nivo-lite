"use client"

import { useTranslations } from "next-intl"
import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import { APP_ROUTES, CONSOLE_ROUTES } from "@/modules/routes"
import { AutomationsHeadingBase } from "./component"

/** The Automations page heading with the words of the automations catalog; the eyebrow is the active workspace name. */
export const AutomationsHeading = () => {
    const t = useTranslations("automations")
    const { activeWorkspaceId } = useActiveWorkspace()
    const { cards } = useWorkspaceCards()
    const workspaceName = cards.find((card) => card.id === activeWorkspaceId)?.name
    return (
        <AutomationsHeadingBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "automations", label: t("title") },
                ],
                ...(workspaceName === undefined ? {} : { eyebrow: workspaceName }),
                title: t("title"),
                leadBefore: t("leadBefore"),
                leadLink: t("leadLink"),
                leadHref: CONSOLE_ROUTES.authority,
                leadAfter: t("leadAfter"),
            }}
        />
    )
}
