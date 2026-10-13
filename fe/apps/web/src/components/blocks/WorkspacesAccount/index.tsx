"use client"

import { useTranslations } from "next-intl"
import { useAuthUser, useAuthActions } from "@/hooks/auth"
import { useSignOut } from "@/hooks/console"
import { useWorkspaceCards } from "@/hooks/workspaces"
import { APP_ROUTES } from "@/modules/routes"
import { WorkspacesAccountBase } from "./component"

/** The connected account menu of the workspaces area: Account (when a workspace is usable) and Sign out. */
export const WorkspacesAccount = () => {
    const auth = useAuthActions()
    const t = useTranslations("onboarding")
    const signOut = useSignOut(auth.endSession)
    const { data: user } = useAuthUser()
    const { cards } = useWorkspaceCards()
    // The Account page lives in the console, which needs a workspace: without one the item would only bounce back.
    const hasWorkspace = cards.some((card) => card.state === "active")
    return (
        <WorkspacesAccountBase
            props={{
                email: user?.email ?? "",
                entries: [
                    ...(hasWorkspace ? [{ id: "account", label: t("accountMenu"), href: APP_ROUTES.account }] : []),
                    { id: "signout", label: t("signOut"), tone: "negative" as const, onAction: signOut.signOut },
                ],
            }}
        />
    )
}
