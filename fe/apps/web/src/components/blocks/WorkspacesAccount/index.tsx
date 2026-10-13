"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/console"
import { writeSignOut } from "@/modules/db/auth/write-sign-out"
import { APP_ROUTES } from "@/modules/routes"
import { WorkspacesAccountBase } from "./component"

/** Props for the connected account menu. */
interface WorkspacesAccountProps {
    readonly email: string
    /** The Account page lives in the console, which needs a workspace: without one the item would only bounce back. */
    readonly hasWorkspace: boolean
}

/** The connected account menu of the workspaces area: Account (when a workspace is usable) and Sign out. */
export const WorkspacesAccount = (props: WorkspacesAccountProps) => {
    const t = useTranslations("onboarding")
    const signOut = useSignOut(writeSignOut)
    return (
        <WorkspacesAccountBase
            props={{
                email: props.email,
                entries: [
                    ...(props.hasWorkspace
                        ? [{ id: "account", label: t("accountMenu"), href: APP_ROUTES.account }]
                        : []),
                    { id: "signout", label: t("signOut"), tone: "negative" as const, onAction: signOut.signOut },
                ],
            }}
        />
    )
}
