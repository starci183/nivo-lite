"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { useLeadJourney } from "@/hooks/leads"
import { LeadPageHeadBase } from "./component"

/** What the lead page hands its head. */
interface LeadPageHeadProps {
    readonly leadId: string
    readonly crumbLabel: string
    /** The trail up to the lead (the dashboard, the leads list). */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The connected slots of the head, composed by the page. */
    readonly slots: {
        readonly mark: ReactNode
        readonly title: ReactNode
        readonly status: ReactNode
        readonly description: ReactNode
        readonly actions: ReactNode
    }
    /** The page body under the head. */
    readonly children: ReactNode
}

/** The connected head of the lead page: the last crumb is the lead's name, a skeleton while the lead loads. */
export const LeadPageHead = (props: LeadPageHeadProps) => {
    const t = useTranslations("leads")
    const { slot } = useLeadJourney(props.leadId)
    const name = slot.items?.lead.contact_name ?? ""
    const lead: BreadcrumbItem =
        slot.isLoading === true
            ? { id: "lead", label: "", isSkeleton: true }
            : { id: "lead", label: name === "" ? t("detailEyebrow") : name }
    return (
        <LeadPageHeadBase
            shape={{ body: props.children, ...props.slots }}
            props={{ crumbLabel: props.crumbLabel, crumbs: [...props.crumbs, lead] }}
        />
    )
}
