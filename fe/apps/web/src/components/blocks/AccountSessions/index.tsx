"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { SessionRowView } from "@/hooks/account"
import { writeRevokeSession } from "@/modules/db/account/write-revoke-session"
import { writeSignOutOthers } from "@/modules/db/account/write-sign-out-others"
import { writeSignOut } from "@/modules/db/auth/write-sign-out"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { AccountSessionsBase } from "./component"

/** Props for the connected sessions section. */
interface AccountSessionsProps {
    /** The devices signed in, current one first, already formatted for the locale. */
    readonly rows: ReadonlyArray<SessionRowView>
    /** True when the device list could not be read. */
    readonly isFailed: boolean
    /** True while the page loads: the labels stay and the rows are skeletons. */
    readonly isLoading?: boolean
}

/** The connected sessions section: signs one other device out, signs all the others out, or ends this session. */
export const AccountSessions = (props: AccountSessionsProps) => {
    const t = useTranslations("account")
    const router = navigation.useRouter()
    const [busy, setBusy] = useState<string>()
    const [error, setError] = useState<string>()
    const [done, setDone] = useState<string>()
    const [, startTransition] = useTransition()

    const run = (key: string, task: () => Promise<{ readonly kind: string }>, text: string, after: () => void) => {
        setBusy(key)
        setError(undefined)
        setDone(undefined)
        startTransition(async () => {
            const result = await task()
            setBusy(undefined)
            if (result.kind !== "ok") return setError(t("unknownError"))
            setDone(text)
            after()
        })
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
                rows: props.rows,
                isFailed: props.isFailed,
                isSkeleton: props.isLoading ?? false,
                hasOthers: props.isLoading === true || props.rows.some((row) => !row.isCurrent),
                busy,
                error,
                done,
            }}
            on={{
                revoke: (id) =>
                    run(
                        id,
                        () => writeRevokeSession(id),
                        t("sessionRevoked"),
                        () => router.refresh(),
                    ),
                signOutOthers: () => run("others", writeSignOutOthers, t("othersDone"), () => router.refresh()),
                signOutThis: () => run("this", writeSignOut, t("signOutThis"), () => router.replace(APP_ROUTES.login)),
            }}
        />
    )
}
