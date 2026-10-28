"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { isManager, useMember } from "@/hooks/member"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { AuthorityHeadBase } from "./component"

/** The sections the page draws under the heading. */
type AuthorityHeadProps = {
    readonly children: ReactNode
}

/** The authority page frame: the words live here, the drawing in the pure half. */
export const AuthorityHead = (props: AuthorityHeadProps) => {
    const t = useTranslations("authority")
    const g = useTranslations("governance")
    const member = useMember()
    return (
        <AuthorityHeadBase
            shape={{ body: props.children }}
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "authority", label: t("title") },
                ],
                title: t("title"),
                description: t("description"),
                motto: g("motto"),
                readOnlyTitle: t("readOnlyTitle"),
                readOnlyBody: t("readOnlyBody"),
                isReadOnly: !isManager(member),
            }}
        />
    )
}
