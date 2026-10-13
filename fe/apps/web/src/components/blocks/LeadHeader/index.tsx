"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { primaryActionOf, STAGE_KEYS, STAGE_TONES } from "@/hooks/leads"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { writeDraftExecution, writeRefreshContext, writeSuggestOwner } from "@/modules/db/leads/write-lead-actions"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import type { LeadJourney, DataSlot } from "@/modules/types"
import { LeadHeaderBase } from "./component"
import type { HeaderView } from "./component"

/** The lead the header names; null while it loads. */
interface LeadHeaderProps {
    readonly detail: LeadJourney | null
    /** The label of the channel the lead came through, already translated when it is a known one. */
    readonly channelLabel: string
}

/** The part of a write outcome the header reads. */
interface ActionResult {
    readonly kind: string
    readonly code?: string
}

/** The header of the lead page: the actions (draft, propose, refresh, copy the link) live here, the drawing in the pure half. */
export const LeadHeader = (props: LeadHeaderProps) => {
    const t = useTranslations("leads")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [notice, setNotice] = useState<string | null>(null)
    const detail = props.detail
    const lead = detail?.lead ?? null

    const run = (action: () => Promise<ActionResult>, done?: string) => {
        setNotice(null)
        startTransition(async () => {
            const result = await action()
            if (result.kind === "ok") {
                if (done !== undefined) setNotice(done)
                router.refresh()
            } else setNotice(result.kind === "unavailable" ? (result.code ?? t("loadFailedLead")) : t("loadFailedLead"))
        })
    }
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
            channel: props.channelLabel,
            time: format.dateTime(new Date(loaded.lead.created_at), { dateStyle: "medium", timeStyle: "short" }),
        }),
        stageLabel: t(STAGE_KEYS[loaded.lead.stage]),
        stageTone: STAGE_TONES[loaded.lead.stage],
        primary: primaryActionOf(loaded),
    })
    const slot: DataSlot<HeaderView> = detail === null ? loadingSlot() : { items: viewOf(detail) }

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
                notice,
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
                draft: (responsibilityId) => run(() => writeDraftExecution(responsibilityId)),
                propose: () => {
                    if (lead !== null) run(() => writeSuggestOwner(lead.id))
                },
                refresh: () => {
                    if (lead !== null) run(() => writeRefreshContext(lead.id), t("noticeRefreshed"))
                },
                copy: () => void copy(),
            }}
        />
    )
}
