"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { inviteTokenOf } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { invitePath } from "@/modules/routes"
import { WorkspaceJoinBase } from "./component"

/** The connected join form: a pasted invitation link (or token) opens that invitation's page. */
export const WorkspaceJoin = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const [value, setValue] = useState("")
    const [error, setError] = useState<string>()

    const submit = () => {
        const token = inviteTokenOf(value)
        if (token === null) return setError(t("errLink"))
        setError(undefined)
        router.push(invitePath(token))
    }

    return (
        <WorkspaceJoinBase
            props={{
                title: t("joinTitle"),
                description: t("joinLinkText"),
                linkLabel: t("haveLink"),
                placeholder: t("linkPlaceholder"),
                openLabel: t("openLink"),
                failTitle: t("errGeneric"),
                value,
                error,
            }}
            on={{ setValue, submit }}
        />
    )
}
