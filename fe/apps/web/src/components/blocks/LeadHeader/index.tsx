"use client"

import { useFormatter, useTranslations } from "next-intl"
import { STAGE_KEYS, STAGE_TONES, useLeadJourney } from "@/hooks/leads"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, LeadJourney } from "@/modules/types"
import { LeadHeaderBase } from "./component"
import type { HeaderView, LeadHeaderPart } from "./component"

/** The lead the head names (none while it loads) and the slot to fill. */
interface LeadHeaderProps {
    readonly leadId?: string
    readonly part: LeadHeaderPart
}

/** One connected slot of the lead page head: the avatar, the name, the stage or the meta line. */
export const LeadHeader = (props: LeadHeaderProps) => {
    const t = useTranslations("leads")
    const format = useFormatter()
    const query = useLeadJourney(props.leadId)
    const viewOf = (loaded: LeadJourney): HeaderView => ({
        name: loaded.lead.contact_name,
        meta: t("metaLine", {
            company: loaded.lead.company,
            channel: query.channelLabel,
            time: format.dateTime(new Date(loaded.lead.created_at), { dateStyle: "medium", timeStyle: "short" }),
        }),
        stageLabel: t(STAGE_KEYS[loaded.lead.stage]),
        stageTone: STAGE_TONES[loaded.lead.stage],
    })
    const slot: DataSlot<HeaderView> = mapSlot(query.slot, viewOf)
    return (
        <LeadHeaderBase
            props={{
                part: props.part,
                view: slot.items,
                isSkeleton: slot.isLoading === true,
                fallbackTitle: t("detailEyebrow"),
            }}
        />
    )
}
