"use client"

import type { ReactNode } from "react"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { useLeadPageHead } from "@/hooks/leads"
import { LeadPageHeadBase } from "./component"

/** What the lead page hands its head. */
interface LeadPageHeadProps {
    /** The lead the head names; none while the page has no lead yet. */
    readonly leadId?: string
    readonly crumbLabel: string
    /** The trail up to the lead (the dashboard, the leads list). */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The page body under the head. */
    readonly children: ReactNode
}

/** The connected head of the lead page: the last crumb is the lead's name, a skeleton while the lead loads. */
export const LeadPageHead = (props: LeadPageHeadProps) => {
    const head = useLeadPageHead(props.leadId)
    return (
        <LeadPageHeadBase
            children={props.children}
            props={{
                crumbLabel: props.crumbLabel,
                crumbs: [...props.crumbs, head.crumb],
                ...head.head,
                ...head.actions,
            }}
            on={head.on}
        />
    )
}
