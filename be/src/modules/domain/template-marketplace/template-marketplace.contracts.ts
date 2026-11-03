import type { TemplateParameter, TemplateText, UpdateOffer, UpdateUnit } from "@nivo-lite/agent-sdk/template"

/** The review state of a listing. */
export type ListingStatus = "draft" | "submitted" | "approved" | "rejected"

/** What a creator earns from a sale, in percent, unless the review sets another. */
export const REVENUE_SHARE_DEFAULT = 70

/** One automated check of the review. */
export interface ListingCheck {
    /** The check. */
    readonly id: string
    /** True when it passed. */
    readonly ok: boolean
    /** What it found. */
    readonly detail: string
}

/** One listing as the creator and the reviewer read it. */
export interface ListingView {
    /** The id. */
    readonly id: string
    /** The template key. */
    readonly templateKey: string
    /** The version offered. */
    readonly version: number
    /** The state. */
    readonly status: ListingStatus
    /** The price in VND; zero is free. */
    readonly priceVnd: number
    /** The percent that is the creator. */
    readonly revenueSharePct: number
    /** The automated checks of the last submit. */
    readonly checks: ReadonlyArray<ListingCheck>
    /** What the reviewer wrote. */
    readonly reviewNote: string
    /** True for a listing of the platform itself. */
    readonly firstParty: boolean
    /** The name on the card. */
    readonly name: TemplateText
    /** When it was last changed, ISO 8601. */
    readonly updatedAt: string
}

/** A listing in the catalogue next to the built-in modules: what the buyer reads before taking it. */
export interface ListingCard {
    /** The listing. */
    readonly id: string
    /** The template key. */
    readonly templateKey: string
    /** The version. */
    readonly version: number
    /** The name. */
    readonly name: TemplateText
    /** The summary. */
    readonly summary: TemplateText
    /** The selling points. */
    readonly points: ReadonlyArray<TemplateText>
    /** The category key. */
    readonly category: string
    /** Who made it. */
    readonly publisherName: string
    /** True for a listing of the platform itself. */
    readonly firstParty: boolean
    /** The price in VND; zero is free. */
    readonly priceVnd: number
    /** The settings the buyer fills in. */
    readonly parameters: ReadonlyArray<TemplateParameter>
    /** The providers to connect. */
    readonly requiredProviders: ReadonlyArray<string>
    /** The actions of the authority matrix that need a rule. */
    readonly requiredAuthorityActions: ReadonlyArray<string>
    /** The real person the persona is modelled on, or null. */
    readonly personName: string | null
}

/** The consent of a real person as the creator reads it. */
export interface LikenessGrantView {
    /** The id. */
    readonly id: string
    /** The template key. */
    readonly templateKey: string
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<string>
    /** The line shown to every customer. */
    readonly disclosure: string
    /** True once a reviewer checked the identity. */
    readonly verified: boolean
    /** When the consent ends, ISO 8601, or null. */
    readonly expiresAt: string | null
    /** True when the person took it back. */
    readonly revoked: boolean
}

/** One line of the ledger of a creator. */
export interface LedgerLine {
    /** The id. */
    readonly id: string
    /** The template. */
    readonly templateKey: string
    /** The paid order. */
    readonly orderId: string
    /** The creator share, or the fee of the platform. */
    readonly kind: "creator_share" | "platform_fee"
    /** The amount in VND. */
    readonly amountVnd: number
    /** When it was written, ISO 8601. */
    readonly createdAt: string
}

/** The creator ledger with its total. */
export interface CreatorLedgerView {
    /** The lines, newest first. */
    readonly lines: ReadonlyArray<LedgerLine>
    /** What the creator is owed in all, VND. */
    readonly owedVnd: number
}

/** The updates offered to the installations of a workspace. */
export interface WorkspaceUpdateOffers {
    /** One offer for each installation with a newer version. */
    readonly offers: ReadonlyArray<UpdateOffer>
}

export type { UpdateOffer, UpdateUnit }
