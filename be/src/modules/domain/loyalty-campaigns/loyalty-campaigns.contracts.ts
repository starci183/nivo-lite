/** Who a promotion is for; a zero, an empty list or false leaves that condition out. */
export interface Segment {
    /** Customers holding one of these tiers. */
    readonly tiers: ReadonlyArray<string>
    /** Customers whose last visit was at least this many days ago (a customer who never bought counts from the day they joined). */
    readonly inactiveDays: number
    /** Customers whose birthday falls in the current month, Vietnam time. */
    readonly birthdayThisMonth: boolean
    /** Customers who spent at least this many VND. */
    readonly minSpendVnd: number
}

/** A customer shown as an example of a segment. */
export interface SampleMember {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The key of the held tier, or null. */
    readonly tierKey: string | null
}

/** How many customers a segment holds and how many of them can be written to. */
export interface SegmentPreview {
    /** The customers the segment holds. */
    readonly total: number
    /** The customers among them that have a chat staff do not handle. */
    readonly reachable: number
    /** The first customers of the segment. */
    readonly sample: ReadonlyArray<SampleMember>
}

/** What the owner asks for when creating a campaign. */
export interface CampaignParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The name of the campaign; empty to name it after the segment. */
    readonly name: string
    /** Who the promotion is for. */
    readonly segment: Segment
    /** The offer, in the owner's words. */
    readonly brief: string
    /** Who creates it: a person or an API key. */
    readonly createdBy: string
}

/** A campaign written as a draft. */
export interface CampaignDraft {
    /** The campaign id. */
    readonly campaignId: string
    /** Where the campaign stands. */
    readonly status: string
    /** The customers it is for. */
    readonly recipients: number
    /** The message, with the placeholder of the customer name left in. */
    readonly draft: string
}

/** One campaign and its delivery counts, shown by the workbench and its status query. */
export interface LoyaltyCampaignView {
    /** The campaign. */
    readonly id: string
    /** The owner's campaign name. */
    readonly name: string
    /** The customers it targets. */
    readonly segment: Segment
    /** The generated or template message, with customer placeholders retained. */
    readonly messageDraft: string
    /** The message using the established campaign field name. */
    readonly draft: string
    /** Drafting waits in `waiting`; a finished message is `draft`. */
    readonly status: string
    /** The decision that authorizes sending, when one exists. */
    readonly workItemId: string | null
    /** The number of recipients. */
    readonly recipients: number
    /** Sent messages. */
    readonly sent: number
    /** Messages waiting for delivery. */
    readonly queued: number
    /** Failed deliveries. */
    readonly failed: number
    /** Skipped deliveries. */
    readonly skipped: number
    /** Time spent preparing the message, milliseconds. */
    readonly draftMs: number | null
    /** The person or API key that requested the campaign. */
    readonly createdBy: string
    /** When it was requested, ISO 8601. */
    readonly createdAt: string
    /** When it ended, ISO 8601. */
    readonly finishedAt: string | null
    /** A stable code when the campaign ended as failed. */
    readonly errorCode: string | null
}

/** The text of one part of a segment label, to be looked up in the message catalog. */
export interface SegmentPart {
    /** The catalog key. */
    readonly key: string
    /** The values that fill the text. */
    readonly params: Readonly<Record<string, string | number>>
}
