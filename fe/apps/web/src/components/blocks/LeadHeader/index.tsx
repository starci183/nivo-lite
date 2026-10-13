"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { primaryActionOf, STAGE_KEYS, STAGE_TONES, useLeadActions, useLeadJourney } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import type { LeadJourney, DataSlot } from "@/modules/types"
import { LeadHeaderBase } from "./component"
import type { HeaderView } from "./component"

/** The lead the header names; null while it loads. */
interface LeadHeaderProps {
    readonly leadId?: string
}

/** The header of the lead page: the actions (draft, propose, refresh, copy the link) live here, the drawing in the pure half. */
export const LeadHeader = (props: LeadHeaderProps) => {
    const t = useTranslations("leads")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const query = useLeadJourney(props.leadId)
    const actions = useLeadActions()
    const isPending = actions.isPending
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
    const viewOf = (loaded: LeadJourney): HeaderView => ({
        name: loaded.lead.contact_name,
        meta: t("metaLine", {
            company: loaded.lead.company,
            channel: query.channelLabel,
            time: format.dateTime(new Date(loaded.lead.created_at), { dateStyle: "medium", timeStyle: "short" }),
        }),
        stageLabel: t(STAGE_KEYS[loaded.lead.stage]),
        stageTone: STAGE_TONES[loaded.lead.stage],
        primary: primaryActionOf(loaded),
    })
    const slot: DataSlot<HeaderView> = mapSlot(query.slot, viewOf)

    return (
        <LeadHeaderBase
            props={{
                slot,
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                    { id: "leads", label: t("title"), href: LEADS_ROUTES.leads },
                    lead === null
                        ? { id: "lead", label: "", isSkeleton: true }
                        : { id: "lead", label: lead.contact_name },
                ],
                notice: notice ?? actions.error,
                isPending,
                labels: {
                    crumbLabel: t("crumbLabel"),
                    reviewLabel: t("reviewApproval"),
                    draftLabel: t("draftFollowUp"),
                    proposeLabel: t("proposeOwner"),
                    officeLabel: t("openOffice"),
                    officeHref: LEADS_ROUTES.chat,
                    menuMore: t("menuMore"),
                    menuRefresh: t("menuRefresh"),
                    menuOutcome: t("menuOutcome"),
                    menuCopy: t("menuCopy"),
                    slot: slotLabels(t("loadFailedLead")),
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
