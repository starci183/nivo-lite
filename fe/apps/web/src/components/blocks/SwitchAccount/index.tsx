"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { writeSignOut } from "@/modules/db/auth/write-sign-out"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { SwitchAccountBase } from "./component"

/** Where the next sign-in should lead (the invitation page). */
type SwitchAccountProps = { readonly next: string }

/** Signs the current person out, then opens the sign-in page that leads back to `next`. */
export const SwitchAccount = (props: SwitchAccountProps) => {
    const t = useTranslations("invite")
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    return (
        <SwitchAccountBase
            props={{ label: t("switchAccount"), isPending }}
            on={{
                switchAccount: () => {
                    startTransition(async () => {
                        await writeSignOut()
                        router.push(loginPath(props.next))
                        router.refresh()
                    })
                },
            }}
        />
    )
}
