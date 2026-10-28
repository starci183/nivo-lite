"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { primaryActionOf, useLeadActions, useLeadJourney } from "@/hooks/leads"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import { LeadHeaderActionsBase } from "./component"

/** The lead the actions act on; none while it loads. */
interface LeadHeaderActionsProps {
    readonly leadId?: string
}

/** The actions of the lead page head (draft, propose, refresh, copy the link) live here, the drawing in the pure half. */
export const LeadHeaderActions = (props: LeadHeaderActionsProps) => {
    const t = useTranslations("leads")
    const query = useLeadJourney(props.leadId)
    const actions = useLeadActions()
    const [notice, setNotice] = useState<string | null>(null)
    const detail = query.detail
    const lead = detail?.lead ?? null

    const copy = async () => {
        if (lead === null) return
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${leadPath(lead.id)}`)
            setNotice(t("noticeCopied"))
        } catch {
            setNotice(t("noticeCopyFail"))
        }
    }

    return (
        <LeadHeaderActionsBase
            props={{
                primary: detail === null ? { kind: "none" } : primaryActionOf(detail),
                notice: notice ?? actions.error,
                isPending: actions.isPending,
                isSkeleton: query.slot.isLoading === true,
                labels: {
                    reviewLabel: t("reviewApproval"),
                    draftLabel: t("draftFollowUp"),
                    proposeLabel: t("proposeOwner"),
                    officeLabel: t("openOffice"),
                    officeHref: LEADS_ROUTES.chat,
                    menuMore: t("menuMore"),
                    menuRefresh: t("menuRefresh"),
                    menuOutcome: t("menuOutcome"),
                    menuCopy: t("menuCopy"),
                },
            }}
            on={{
                draft: (responsibilityId) => {
                    void actions.draftExecution(responsibilityId)
                },
                propose: () => {
                    if (lead !== null) void actions.suggestOwner(lead.id)
                },
                refresh: () => {
                    if (lead !== null) void actions.refreshContext(lead.id)
                },
                copy: () => void copy(),
            }}
        />
    )
}
