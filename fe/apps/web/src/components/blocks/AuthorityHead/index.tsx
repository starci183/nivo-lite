"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { AuthorityHeadBase } from "./component"

/** The authority heading: the words live here, the drawing in the pure half. */
export const AuthorityHead = () => {
    const t = useTranslations("authority")
    const g = useTranslations("governance")
    const member = useMember()
    return (
        <AuthorityHeadBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "authority", label: t("title") },
                ],
                eyebrow: t("eyebrow"),
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
