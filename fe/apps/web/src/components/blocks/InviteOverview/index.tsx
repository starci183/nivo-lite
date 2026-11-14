"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { authActionsOf } from "@/hooks/auth"
import { useAcceptInvite, useInviteView } from "@/hooks/invite"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, invitePath, loginPath, workspaceHref } from "@/modules/routes"
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
    const read = useInviteView(props.token)
    const slotLabels = useSlotLabels()
    const { accept, isAccepting } = useAcceptInvite()
    const [isSwitching, startSwitch] = useTransition()
    return (
        <InviteOverviewBase
            props={{
                slot: read.slot,
                placeholder: read.placeholder,
                slotLabels: slotLabels(t("invalidTitle")),
                acceptLabel: t("accept"),
                switchLabel: t("switchAccount"),
                isAccepting,
                isSwitching,
            }}
            on={{
                accept: () => {
                    void accept(props.token).then((workspaceId) => {
                        if (workspaceId === undefined) return
                        router.push(workspaceHref(workspaceId, APP_ROUTES.workspaceHome))
                        router.refresh()
                    })
                },
                retry: read.retry,
                switchAccount: () => {
                    startSwitch(async () => {
                        await auth.endSession()
                        router.push(loginPath(invitePath(props.token)))
                        router.refresh()
                    })
                },
            }}
        />
    )
}
