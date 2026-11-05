"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { AuthorityReadOnlyBase } from "./component"

/** The view-only note: shown to staff (the server refuses their changes too), nothing for an owner or a manager. */
export const AuthorityReadOnly = () => {
    const t = useTranslations("authority")
    const member = useMember()
    if (isManager(member)) return null
    return <AuthorityReadOnlyBase props={{ title: t("readOnlyTitle"), body: t("readOnlyBody") }} />
}
