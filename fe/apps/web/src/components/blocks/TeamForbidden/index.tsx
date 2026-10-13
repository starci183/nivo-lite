"use client"

import { useTranslations } from "next-intl"
import { useMember } from "@/hooks/member"
import { isTeamManager } from "@/hooks/team"
import { APP_ROUTES } from "@/modules/routes"
import { TeamForbiddenBase } from "./component"

/** The connected 403: draws the notice for a member who is not an owner or a manager, and nothing for anyone else. */
export const TeamForbidden = () => {
    const t = useTranslations("team")
    const member = useMember()
    if (member === null || isTeamManager(member.role)) return null
    return (
        <TeamForbiddenBase
            props={{
                eyebrow: t("eyebrow"),
                title: t("forbiddenTitle"),
                body: t("forbiddenBody"),
                backLabel: t("forbiddenBack"),
                backHref: APP_ROUTES.chat,
            }}
        />
    )
}
