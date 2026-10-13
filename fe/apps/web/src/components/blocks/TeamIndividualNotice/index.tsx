"use client"

import { useTranslations } from "next-intl"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { isTeamManager } from "@/hooks/team"
import { workspaceBillingPath } from "@/modules/routes"
import { TeamIndividualNoticeBase } from "./component"

/** Tells an owner or manager on an individual plan why nobody can be invited, and where the Team plan is. */
export const TeamIndividualNotice = () => {
    const t = useTranslations("team")
    const member = useMember()
    const isIndividual = useIndividualPlan(member?.workspaceId)
    if (member === null || !isTeamManager(member.role) || !isIndividual) return null
    return (
        <TeamIndividualNoticeBase
            props={{
                title: t("individualTitle"),
                body: t("individualText"),
                ctaLabel: t("individualCta"),
                ctaHref: workspaceBillingPath(member.workspaceId),
            }}
        />
    )
}
