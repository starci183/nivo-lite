"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { inviteErrorKey } from "@/hooks/auth"
import { writeAcceptInvite } from "@/modules/db/invite/write-accept-invite"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { AcceptInviteBase } from "./component"

/** The invitation the signed-in person is about to accept. */
type AcceptInviteProps = { readonly token: string }

/** The "join workspace" button: accepts the invitation for the signed-in person, then opens the console. */
export const AcceptInvite = (props: AcceptInviteProps) => {
    const t = useTranslations("invite")
    const router = navigation.useRouter()
    const [error, setError] = useState<string>()
    const [isPending, startTransition] = useTransition()
    const accept = () => {
        setError(undefined)
        startTransition(async () => {
            const outcome = await writeAcceptInvite(props.token)
            if (outcome.kind === "ok") {
                router.push(APP_ROUTES.chat)
                router.refresh()
                return
            }
            setError(t(inviteErrorKey(outcome.code)))
        })
    }
    return (
        <AcceptInviteBase
            props={{ acceptLabel: t("accept"), failedTitle: t("failed"), error, isPending }}
            on={{ accept }}
        />
    )
}
