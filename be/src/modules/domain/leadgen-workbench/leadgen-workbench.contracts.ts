import type { LeadView } from "@modules/domain/leads"
import type { WorkItem, WorkStatus } from "@modules/domain/work-items"

/** The network a lead arrived from. */
export type LeadGenPlatform = "facebook" | "instagram" | "other"
/** How a lead arrived. */
export type LeadGenSourceKind = "lead_ad" | "dm" | "comment" | "mention" | "other"
/** How warm a lead is, from the owner criteria. */
export type LeadGenScore = "hot" | "warm" | "cold"

/** Where a lead came from and the post, ad or form attributed to it. */
export interface LeadGenOrigin {
    /** The network the prospect arrived from. */
    readonly platform: LeadGenPlatform
    /** The way the prospect arrived. */
    readonly kind: LeadGenSourceKind
    /** The source reference kind, when captured. */
    readonly refKind: "post" | "ad" | "form" | null
    /** The platform source identifier, when captured. */
    readonly refId: string | null
    /** The readable source name, when captured. */
    readonly refLabel: string | null
}

/** One prospect and its latest conversation. */
export interface LeadGenLead {
    /** The record identifier. */
    readonly id: string
    /** The customer name. */
    readonly name: string
    /** The journey stage. */
    readonly stage: string
    /** The temperature assigned by the scoring agent. */
    readonly score: LeadGenScore | null
    /** The source attribution. */
    readonly origin: LeadGenOrigin
    /** The latest conversation summary. */
    readonly lastText: string
    /** The time of the latest conversation. */
    readonly lastAt: string
    /** The lead creation time. */
    readonly createdAt: string
    /** The path to the lead journey. */
    readonly href: string
}

/** One source with the number of leads it brought. */
export interface LeadGenSource {
    /** The stable identity of this row. */
    readonly key: string
    /** The source attribution. */
    readonly origin: LeadGenOrigin
    /** The prospects represented by this projection. */
    readonly leads: number
    /** The number of prospects scored hot. */
    readonly hot: number
    /** The number of prospects won. */
    readonly won: number
}

/** A public comment reply waiting for a person's decision. */
export interface LeadGenComment {
    /** The work item whose public reply is waiting for approval. */
    readonly workItemId: string
    /** The network the prospect arrived from. */
    readonly platform: LeadGenPlatform
    /** The comment author. */
    readonly author: string
    /** The customer comment. */
    readonly comment: string
    /** The proposed reply. */
    readonly draft: string
    /** The readable source name, when captured. */
    readonly refLabel: string | null
    /** The recorded time. */
    readonly at: string
}

/** A prospect handed to Sales and its classification status. */
export interface LeadGenHandoff {
    /** The stable identity of this row. */
    readonly key: string
    /** The prospect handed to Sales. */
    readonly leadId: string
    /** The customer name. */
    readonly name: string
    /** The temperature assigned by the scoring agent. */
    readonly score: LeadGenScore | null
    /** The recorded time. */
    readonly at: string
    /** The classification work status, when started. */
    readonly classify: WorkStatus | null
    /** The journey stage. */
    readonly stage: string
    /** The path to the lead journey. */
    readonly href: string
}

/** The header figures of the Lead Gen workbench. */
export interface LeadGenMetrics {
    /** The number of leads created today in Vietnam time. */
    readonly newToday: number
    /** Hot open prospects Sales has not finished classifying. */
    readonly hotWaiting: number
    /** The median first reply delay in minutes over thirty days. */
    readonly firstReplyP50Min: number | null
    /** The number of conversations in the reply sample. */
    readonly firstReplySample: number
    /** The duration of the conversion window in days. */
    readonly conversionWindowDays: number
    /** The number of prospects created in the conversion window. */
    readonly conversionLeads: number
    /** Prospects created in the conversion window that reached won. */
    readonly conversionWon: number
}

/** Everything the Lead Gen workbench reads. */
export interface LeadGenWorkbench {
    /** The figures derived from prospect and conversation records. */
    readonly metrics: LeadGenMetrics
    /** The prospects represented by this projection. */
    readonly leads: ReadonlyArray<LeadGenLead>
    /** The number of prospects beyond the displayed limit. */
    readonly leadsHidden: number
    /** The sources ranked by their prospect counts. */
    readonly sources: ReadonlyArray<LeadGenSource>
    /** The public reply drafts waiting for approval. */
    readonly comments: ReadonlyArray<LeadGenComment>
    /** The prospects handed to Sales. */
    readonly handoffs: ReadonlyArray<LeadGenHandoff>
}

/** One customer conversation attached to a lead. */
export interface LeadGenConversation {
    /** The record identifier. */
    readonly id: string
    /** The lead attached to the customer conversation. */
    readonly lead_id: string | null
}

/** One message inside the conversion window. */
export interface LeadGenMessage {
    /** The conversation this message belongs to. */
    readonly conversation_id: string
    /** Who wrote the conversation message. */
    readonly role: string
    /** The stored message text. */
    readonly body: string
    /** The message creation time. */
    readonly created_at: string
}

/** The already scoped rows from which the workbench is derived. */
export interface LeadGenRows {
    /** The clock instant against which figures are derived. */
    readonly nowMs: number
    /** The installed Lead Gen agent to select, or null for all instances. */
    readonly installationId: string | null
    /** The prospects represented by this projection. */
    readonly leads: ReadonlyArray<LeadView>
    /** The newest work items of this workspace. */
    readonly items: ReadonlyArray<WorkItem>
    /** Customer conversations attached to leads. */
    readonly conversations: ReadonlyArray<LeadGenConversation>
    /** Conversation messages inside the conversion window. */
    readonly messages: ReadonlyArray<LeadGenMessage>
}

/** The active workspace and optional installed agent selected by the caller. */
export interface LeadGenWorkbenchSelection {
    /** The active workspace. */
    readonly workspaceId: string
    /** One installed agent; absent selects every instance. */
    readonly installationId?: string | null
}

/** The latest message summary and its recorded time. */
export interface LeadGenLastMessage {
    /** The clipped message summary. */
    readonly text: string
    /** The message creation time. */
    readonly at: string
}

/** Conversation facts used by the prospect projection. */
export interface LeadGenConversationFacts {
    /** The latest message per lead. */
    readonly last: Map<string, LeadGenLastMessage>
    /** First reply delays in minutes inside the reply window. */
    readonly replyMinutes: Array<number>
}
