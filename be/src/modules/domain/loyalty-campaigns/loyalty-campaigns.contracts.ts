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

/** The text of one part of a segment label, to be looked up in the message catalog. */
export interface SegmentPart {
    /** The catalog key. */
    readonly key: string
    /** The values that fill the text. */
    readonly params: Readonly<Record<string, string | number>>
}
