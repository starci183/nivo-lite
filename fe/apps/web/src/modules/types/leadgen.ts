import type { FlowWorkStatus } from "./flow"

/** The network a lead arrived from. */
export type LeadPlatform = "facebook" | "instagram" | "other"

/** How a lead arrived. */
export type LeadSourceKind = "lead_ad" | "dm" | "comment" | "mention" | "other"

/** How warm a lead is, from the owner criteria. */
export type LeadScore = "hot" | "warm" | "cold"

/** Where a lead came from: the platform, how it arrived and the post, ad or form it is attributed to. */
export interface LeadOrigin {
    readonly platform: LeadPlatform
    readonly kind: LeadSourceKind
    readonly refKind: "post" | "ad" | "form" | null
    readonly refId: string | null
    /** A readable name of the post, ad or form when the capture stored one. */
    readonly refLabel: string | null
}

/** One row of the prospects list. */
export interface LeadGenLead {
    readonly id: string
    readonly name: string
    readonly stage: string
    readonly score: LeadScore | null
    readonly origin: LeadOrigin
    readonly lastText: string
    readonly lastAt: string
    readonly createdAt: string
    readonly href: string
}

/** One source (post, ad, form or way of arrival) with how many leads it brought. */
export interface LeadGenSource {
    readonly key: string
    readonly origin: LeadOrigin
    readonly leads: number
    readonly hot: number
    readonly won: number
}

/** A comment waiting for a decision. */
export interface LeadGenComment {
    readonly workItemId: string
    readonly platform: LeadPlatform
    readonly author: string
    readonly comment: string
    readonly draft: string
    readonly refLabel: string | null
    readonly at: string
}

/** A lead handed to Sales and where the Sales step stands. */
export interface LeadGenHandoff {
    readonly key: string
    readonly leadId: string
    readonly name: string
    readonly score: LeadScore | null
    readonly at: string
    /** Status of the sales classify_lead work item; null when Sales has not been given one yet. */
    readonly classify: FlowWorkStatus | null
    readonly stage: string
    readonly href: string
}

/** The header figures of the Lead Gen workbench. */
export interface LeadGenMetrics {
    readonly newToday: number
    readonly hotWaiting: number
    /** Median minutes from a first message to the first reply, last 30 days; null with no data. */
    readonly firstReplyP50Min: number | null
    readonly firstReplySample: number
    readonly conversionWindowDays: number
    readonly conversionLeads: number
    readonly conversionWon: number
}

/** Everything the Lead Gen workbench reads. */
export interface LeadGenWorkbenchData {
    readonly metrics: LeadGenMetrics
    readonly leads: ReadonlyArray<LeadGenLead>
    readonly leadsHidden: number
    readonly sources: ReadonlyArray<LeadGenSource>
    readonly comments: ReadonlyArray<LeadGenComment>
    readonly handoffs: ReadonlyArray<LeadGenHandoff>
}
