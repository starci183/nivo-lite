"use client"

import { useTranslations } from "next-intl"
import { useQueryAuthUserSwr, authActionsOf } from "@/hooks/auth"
import { useSignOut } from "@/hooks/console"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useWorkspaceCards } from "@/hooks/workspaces"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { WorkspacesAccountBase } from "./component"

/** The connected account menu of the workspaces area: Account (when a workspace is usable) and Sign out. */
export const WorkspacesAccount = () => {
    const auth = authActionsOf()
    const t = useTranslations("onboarding")
    const signOut = useSignOut(auth.endSession)
    const slotLabels = useSlotLabels()
    const userRead = useQueryAuthUserSwr()
    const { cards } = useWorkspaceCards()
    // The Account page lives in a workspace of the console: the first usable one opens it, and without one the item would only bounce back.
    const usable = cards.find((card) => card.state === "active")
    return (
        <WorkspacesAccountBase
            props={{
                slot: mapSlot(slotOfSwr(userRead), (user) => user?.email ?? ""),
                labels: slotLabels(t("accountMenu")),
                entries: [
                    ...(usable === undefined
                        ? []
                        : [
                              {
                                  id: "account",
                                  label: t("accountMenu"),
                                  href: workspaceHref(usable.id, APP_ROUTES.account),
                              },
                          ]),
                    { id: "signout", label: t("signOut"), tone: "danger" as const, onAction: signOut.signOut },
                ],
            }}
            on={{ retry: () => void userRead.mutate() }}
        />
    )
}
