"use client"

import type { BreadcrumbItem } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { mapSlot } from "@/hooks/slot"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import type { DataSlot, LeadJourney } from "@/modules/types"
import { STAGE_KEYS, STAGE_TONES, primaryActionOf } from "./leads.shared"
import { useLeadActions } from "./useLeadActions"
import { useLeadJourney } from "./useLeadJourney"

/** Reads the lead of the page once and resolves the head of the lead page: the trail's last crumb, the heading words and the action bar. */
export const useLeadPageHead = (leadId: string | undefined) => {
    const t = useTranslations("leads")
    const format = useFormatter()
    const query = useLeadJourney(leadId)
    const actions = useLeadActions()
    const [notice, setNotice] = useState<string | null>(null)
    const detail = query.detail
    const lead = detail?.lead ?? null
    const viewOf = (loaded: LeadJourney) => ({
        name: loaded.lead.contact_name,
        meta: t("metaLine", {
            company: loaded.lead.company,
            channel: query.channelLabel,
            time: format.dateTime(new Date(loaded.lead.created_at), { dateStyle: "medium", timeStyle: "short" }),
        }),
        stageLabel: t(STAGE_KEYS[loaded.lead.stage]),
        stageTone: STAGE_TONES[loaded.lead.stage],
    })
    const slot: DataSlot<ReturnType<typeof viewOf>> = mapSlot(query.slot, viewOf)
    const name = ("items" in query.slot ? query.slot.items : undefined)?.lead.contact_name ?? ""
    const crumb: BreadcrumbItem =
        "isLoading" in query.slot
            ? { id: "lead", label: "", isLoading: true }
            : { id: "lead", label: name === "" ? t("detailEyebrow") : name }
    const isSkeleton = "isLoading" in slot && slot.isLoading === true

    const copy = async () => {
        if (lead === null) return
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${leadPath(lead.id)}`)
            setNotice(t("noticeCopied"))
        } catch {
            setNotice(t("noticeCopyFail"))
        }
    }

    return {
        crumb,
        head: {
            view: "items" in slot ? slot.items : undefined,
            isSkeleton,
            fallbackTitle: t("detailEyebrow"),
        },
        actions: {
            primary: detail === null ? ({ kind: "none" } as const) : primaryActionOf(detail),
            notice: notice ?? actions.error,
            isPending: actions.isPending,
            isLoading: "isLoading" in query.slot,
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
        },
        on: {
            draft: (responsibilityId: string) => {
                void actions.draftExecution(responsibilityId)
            },
            propose: () => {
                if (lead !== null) void actions.suggestOwner(lead.id)
            },
            refresh: () => {
                if (lead !== null) void actions.refreshContext(lead.id)
            },
            copy: () => void copy(),
        },
    }
}
