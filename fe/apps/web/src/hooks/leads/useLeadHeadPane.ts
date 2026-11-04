"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { mapSlot } from "@/hooks/slot"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import type { LeadHeadLabels, LeadHeadPane, LeadHeadView, LeadJourney } from "@/modules/types"
import { STAGE_KEYS, STAGE_TONES, primaryActionOf } from "./leads.shared"
import { useLeadActions } from "./useLeadActions"
import { useLeadJourney } from "./useLeadJourney"

/** The head band of one lead: what it says, which command is primary, and the commands of its menu. */
export interface LeadHeadPaneView {
    readonly pane: LeadHeadPane
    readonly labels: LeadHeadLabels
    readonly on: {
        readonly draft: (responsibilityId: string) => void
        readonly refresh: () => void
        readonly copy: () => void
    }
}

/** Reads the lead once and resolves the head band: name, line, stage, the one primary command and the notice of the last command. */
export const useLeadHeadPane = (leadId: string | undefined): LeadHeadPaneView => {
    const t = useTranslations("leads")
    const format = useFormatter()
    const query = useLeadJourney(leadId)
    const actions = useLeadActions()
    const [notice, setNotice] = useState<string | null>(null)
    const detail = query.detail
    const viewOf = (loaded: LeadJourney): LeadHeadView => ({
        name: loaded.lead.contact_name,
        meta: t("metaLine", {
            company: loaded.lead.company,
            channel: query.channelLabel,
            time: format.dateTime(new Date(loaded.lead.created_at), { dateStyle: "medium", timeStyle: "short" }),
        }),
        stageLabel: t(STAGE_KEYS[loaded.lead.stage]),
        stageTone: STAGE_TONES[loaded.lead.stage],
    })
    const primary = detail === null ? ({ kind: "none" } as const) : primaryActionOf(detail)
    const copy = async () => {
        if (detail === null) return
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${leadPath(detail.lead.id)}`)
            setNotice(t("noticeCopied"))
        } catch {
            setNotice(t("noticeCopyFail"))
        }
    }
    return {
        pane: {
            slot: mapSlot(query.slot, viewOf),
            primary: primary.kind === "draft" ? "draft" : "none",
            responsibilityId: primary.kind === "draft" ? primary.responsibilityId : null,
            notice: notice ?? actions.error,
            isPending: actions.isPending,
            canOpenStepMenu: detail !== null,
        },
        labels: {
            draft: t("draftFollowUp"),
            office: t("openOffice"),
            officeHref: LEADS_ROUTES.chat,
            moreActions: t("menuMore"),
            infoOpen: t("infoOpen"),
            infoClose: t("infoClose"),
            menuRefresh: t("menuRefresh"),
            menuOutcome: t("menuOutcome"),
            menuReassign: t("menuReassign"),
            menuDue: t("menuDue"),
            menuCopy: t("menuCopy"),
            menuCopyBrief: t("menuCopyBrief"),
            fallbackTitle: t("detailTitle"),
        },
        on: {
            draft: (responsibilityId) => {
                setNotice(null)
                void actions.draftExecution(responsibilityId)
            },
            refresh: () => {
                setNotice(null)
                if (detail !== null) void actions.refreshContext(detail.lead.id)
            },
            copy: () => void copy(),
        },
    }
}
