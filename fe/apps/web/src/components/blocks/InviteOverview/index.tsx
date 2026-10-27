"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { authActionsOf } from "@/hooks/auth"
import { useAcceptInvite, useInviteView } from "@/hooks/invite"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, loginPath } from "@/modules/routes"
import { InviteOverviewBase } from "./component"

/** The invitation the page is about. */
type InviteOverviewProps = { readonly token: string }

/**
 * The connected invitation card: reads the invitation from the back end GraphQL API and the visitor from the browser session;
 * accepts the invitation (outcome toasted) or signs out to use another account.
 */
export const InviteOverview = (props: InviteOverviewProps) => {
    const t = useTranslations("invite")
    const router = navigation.useRouter()
    const auth = authActionsOf()
    const view = useInviteView(props.token)
    const { accept, isAccepting } = useAcceptInvite()
    const [isSwitching, startSwitch] = useTransition()
    return (
        <InviteOverviewBase
            shape={view.state === "loading" ? "ready" : view.state}
            props={{
                view,
                isSkeleton: view.state === "loading",
                acceptLabel: t("accept"),
                switchLabel: t("switchAccount"),
                isAccepting,
                isSwitching,
            }}
            on={{
                accept: () => {
                    void accept(props.token).then((workspaceId) => {
                        if (workspaceId === undefined) return
                        router.push(APP_ROUTES.chat)
                        router.refresh()
                    })
                },
                switchAccount: () => {
                    startSwitch(async () => {
                        await auth.endSession()
                        router.push(loginPath(view.next))
                        router.refresh()
                    })
                },
            }}
        />
    )
}
