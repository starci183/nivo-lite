"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAccountCommands, useAccountSessions, useSignOutOthers } from "@/hooks/account"
import { useAuthActions } from "@/hooks/auth"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { AccountSessionsBase } from "./component"

/** The connected sessions section: signs one other device out, signs all the others out, or ends this session. */
export const AccountSessions = () => {
    const auth = useAuthActions()
    const t = useTranslations("account")
    const router = navigation.useRouter()
    const { rows, isFailed, isLoading } = useAccountSessions()
    const { revokeSession } = useAccountCommands()
    const others = useSignOutOthers()
    const [busy, setBusy] = useState<string>()

    const run = async (key: string, task: () => Promise<unknown>) => {
        setBusy(key)
        await task()
        setBusy(undefined)
    }

    return (
        <AccountSessionsBase
            props={{
                title: t("sessionsTitle"),
                hint: t("sessionsHint"),
                currentLabel: t("current"),
                signOutLabel: t("signOut"),
                signOutThisLabel: t("signOutThis"),
                signOutOthersLabel: t("signOutOthers"),
                noOthersLabel: t("noOthers"),
                failedTitle: t("sessionsFailed"),
                failTitle: t("failTitle"),
                rows,
                isFailed,
                isSkeleton: isLoading,
                hasOthers: isLoading || rows.some((row) => !row.isCurrent),
                busy,
            }}
            on={{
                revoke: (id) => void run(id, () => revokeSession(id)),
                signOutOthers: () => void run("others", others.run),
                signOutThis: () =>
                    void run("this", async () => {
                        const outcome = await auth.endSession()
                        if (outcome.kind === "ok") router.replace(APP_ROUTES.login)
                    }),
            }}
        />
    )
}
