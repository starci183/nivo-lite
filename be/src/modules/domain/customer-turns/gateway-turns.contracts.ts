/** What a guest asked the Sales agent for, as the reply contract's `hotel_request` member names it. */
export type HotelIntent = "spa_slots" | "spa_hold" | "room_search" | "room_hold"

/** One hotel request of a customer reply, read and bounded. */
export interface HotelRequest {
    /** The intent. */
    readonly intent: HotelIntent
    /** The spa service key ("massage-60"), or empty. */
    readonly service: string
    /** The date of the spa slot or the check-in, YYYY-MM-DD, or null. */
    readonly date: string | null
    /** The wished time, HH:MM, or null. */
    readonly time: string | null
    /** How many people. */
    readonly partySize: number
    /** Nights of a room stay. */
    readonly nights: number
    /** The room type, or empty. */
    readonly roomType: string
    /** The guest's name as they gave it, or empty: a hold waits for it. */
    readonly name: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The discount the guest asked for, percent, or null. */
    readonly discountPct: number | null
}

/** Where a guest stands with the hotel, as HAKUEN's stay says. */
export type StayStage =
    | { readonly kind: "none" }
    | { readonly kind: "booked"; readonly confirmed: boolean; readonly checkIn: string }
    | { readonly kind: "checked_in" }
    | { readonly kind: "checked_out"; readonly at: string }

/** Who owns a conversation now. */
export type OwnerRole = "sales" | "care"

/** Why ownership moved. */
export type OwnershipReason = "pre_arrival" | "arrival_day" | "checked_in" | "checked_out_24h"

/** The owner the policy picks, and why. */
export interface OwnerChoice {
    /** Sales or care. */
    readonly role: OwnerRole
    /** Why. */
    readonly reason: OwnershipReason
}

/** The guest context fetched before a turn. */
export interface GuestContext {
    /** HAKUEN's guest id, or null when the guest is new. */
    readonly guestId: string | null
    /** The guest's name in HAKUEN, or empty. */
    readonly name: string
    /** The guest's tier, or empty. */
    readonly tier: string
    /** The stay id, or null. */
    readonly stayId: string | null
    /** The room, or empty. */
    readonly room: string
    /** The stage. */
    readonly stage: StayStage
}

/** A line posted to the Hub (adapter of the Hub card contract v1). */
export interface HubNote {
    /** The workspace. */
    readonly workspaceId: string
    /** The department the line belongs to (work-item department style): "sales", "care", "frontdesk". */
    readonly room: string
    /** The card type of contract v1. */
    readonly type: "booking_held" | "handoff_note" | "approval_request" | "exception"
    /** The title. */
    readonly title: string
    /** Label/value rows. */
    readonly fields: ReadonlyArray<{ readonly label: string; readonly value: string }>
    /** The speaking agent's name. */
    readonly authorName: string
}
