"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAccountCommands, useAccountSessions, useSignOutOthers } from "@/hooks/account"
import { authActionsOf } from "@/hooks/auth"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { AccountSessionsBase } from "./component"

/** The two devices of the skeleton: the current one and another, with no facts. */
const placeholderOf = (unknown: string) => [
    { id: "current", device: unknown, facts: unknown, isCurrent: true, isPhone: false },
    { id: "other", device: unknown, facts: unknown, isCurrent: false, isPhone: false },
]

/** The connected sessions section: signs one other device out after a confirmation, signs all the others out, or ends this session. */
export const AccountSessions = () => {
    const auth = authActionsOf()
    const t = useTranslations("account")
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAccountSessions()
    const { revokeSession } = useAccountCommands()
    const others = useSignOutOthers()
    const [busy, setBusy] = useState<string>()
    const [asking, setAsking] = useState<string>()

    const run = async (key: string, task: () => Promise<unknown>) => {
        setBusy(key)
        await task()
        setBusy(undefined)
    }
    const device = "items" in slot ? slot.items.find((row) => row.id === asking)?.device : undefined

    return (
        <AccountSessionsBase
            props={{
                title: t("sessionsTitle"),
                hint: t("sessionsHint"),
                currentLabel: t("current"),
                signOutLabel: t("signOut"),
                signOutOthersLabel: t("signOutOthers"),
                paging: {
                    nav: t("pageNav"),
                    previous: t("pagePrev"),
                    next: t("pageNext"),
                },
                failTitle: t("failTitle"),
                slot,
                placeholder: placeholderOf(t("deviceUnknown")),
                labels: slotLabels(t("sessionsFailed")),
                busy,
                ...(asking === undefined || device === undefined
                    ? {}
                    : {
                          confirm: {
                              id: asking,
                              title: t("revokeTitle", { device }),
                              body: t("revokeBody"),
                              cancelLabel: t("cancel"),
                          },
                      }),
            }}
            on={{
                retry: reload,
                pageLabel: (page) => t("pageLabel", { page }),
                pageSummary: (from, to, total) => t("pageSummary", { from, to, total }),
                askRevoke: setAsking,
                cancelRevoke: () => setAsking(undefined),
                revoke: (id) =>
                    void run(id, async () => {
                        await revokeSession(id)
                        setAsking(undefined)
                    }),
                signOutOthers: () => void run("others", others.run),
                signOutThis: () =>
                    void run("this", async () => {
                        const outcome = await auth.endSession()
                        if (outcome.success) router.replace(APP_ROUTES.login)
                    }),
            }}
        />
    )
}
