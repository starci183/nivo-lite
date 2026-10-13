import type { WorkStatus } from "@modules/domain/decisions"

/** The network a lead arrived from. */
export type LeadPlatform = "facebook" | "instagram" | "other"

/** How a lead arrived. */
export type LeadSourceKind = "lead_ad" | "dm" | "comment" | "mention" | "other"

/** How warm a lead is, from the owner criteria. */
export type LeadScore = "hot" | "warm" | "cold"

/** Where a lead came from: the platform, how it arrived and the post, ad or form it is attributed to. */
export interface LeadOrigin {
    /** The source network of the captured prospect. */
    readonly platform: LeadPlatform
    /** How the prospect arrived. */
    readonly kind: LeadSourceKind
    /** Kind of the attributed post, ad or lead form. */
    readonly refKind: "post" | "ad" | "form" | null
    /** Identity of the attributed source, when present. */
    readonly refId: string | null
    /** A readable name of the post, ad or form when the capture stored one. */
    readonly refLabel: string | null
}

/** One row of the prospects list. */
export interface LeadGenLead {
    /** Identity of the stored record. */
    readonly id: string
    /** Customer display name. */
    readonly name: string
    /** Current sales stage. */
    readonly stage: string
    /** Hot, warm or cold when a score was captured. */
    readonly score: LeadScore | null
    /** The source attributed to this prospect. */
    readonly origin: LeadOrigin
    /** Preview of the latest customer conversation. */
    readonly lastText: string
    /** Instant of the latest customer activity. */
    readonly lastAt: string
    /** Capture instant, ISO 8601. */
    readonly createdAt: string
    /** Path to inspect the prospect. */
    readonly href: string
}

/** One source (post, ad, form or way of arrival) with how many leads it brought. */
export interface LeadGenSource {
    /** Stable identity of this grouped source or handoff. */
    readonly key: string
    /** The source attributed to this prospect. */
    readonly origin: LeadOrigin
    /** The captured prospects included in this workbench. */
    readonly leads: number
    /** Count of hot prospects from this source. */
    readonly hot: number
    /** Count of won prospects from this source. */
    readonly won: number
}

/** A comment waiting for a decision. */
export interface LeadGenComment {
    /** The public-comment work item whose decision is requested. */
    readonly workItemId: string
    /** The source network of the captured prospect. */
    readonly platform: LeadPlatform
    /** The commenter display name. */
    readonly author: string
    /** The original public comment. */
    readonly comment: string
    /** An optional edited reply; omission keeps the proposed draft. */
    readonly draft: string
    /** Readable source label, when captured. */
    readonly refLabel: string | null
    /** Instant of the source message or handoff. */
    readonly at: string
}

/** A lead handed to Sales and where the Sales step stands. */
export interface LeadGenHandoff {
    /** Stable identity of this grouped source or handoff. */
    readonly key: string
    /** The captured prospect linked to this record. */
    readonly leadId: string
    /** Customer display name. */
    readonly name: string
    /** Hot, warm or cold when a score was captured. */
    readonly score: LeadScore | null
    /** Instant of the source message or handoff. */
    readonly at: string
    /** Status of the sales classify_lead work item; null when Sales has not been given one yet. */
    readonly classify: WorkStatus | null
    /** Current sales stage. */
    readonly stage: string
    /** Path to inspect the prospect. */
    readonly href: string
}

/** The header figures of the Lead Gen workbench. */
export interface LeadGenMetrics {
    /** Prospects captured in the current reporting day. */
    readonly newToday: number
    /** Hot prospects awaiting Sales classification. */
    readonly hotWaiting: number
    /** Median minutes from a first message to the first reply, last 30 days; null with no data. */
    readonly firstReplyP50Min: number | null
    /** Number of conversations behind the response median. */
    readonly firstReplySample: number
    /** Days included in the conversion measurement. */
    readonly conversionWindowDays: number
    /** Prospects captured inside the conversion window. */
    readonly conversionLeads: number
    /** Won prospects inside that conversion window. */
    readonly conversionWon: number
}

/** Everything the Lead Gen workbench reads. */
export interface LeadGenWorkbenchData {
    /** The header figures derived from stored lead and conversation evidence. */
    readonly metrics: LeadGenMetrics
    /** The captured prospects included in this workbench. */
    readonly leads: ReadonlyArray<LeadGenLead>
    /** Prospects omitted by the visible list limit. */
    readonly leadsHidden: number
    /** Grouped lead sources and their outcome counts. */
    readonly sources: ReadonlyArray<LeadGenSource>
    /** Public reply proposals awaiting a decision. */
    readonly comments: ReadonlyArray<LeadGenComment>
    /** Prospects handed to Sales and their next-step status. */
    readonly handoffs: ReadonlyArray<LeadGenHandoff>
}

/** Optional instance scope; omission and null include every instance in the workspace. */
export type LeadGenInstallationId = string | null | undefined
