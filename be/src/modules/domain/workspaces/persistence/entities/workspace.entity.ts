import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** The billing states the table checks. */
export type WorkspaceState = "pending_payment" | "active" | "past_due" | "cancelled"

/** The theme parameters as the column stores them: the parameters only, never the derived tokens. */
export interface WorkspaceThemeRow {
    /** The hue of the accent. */
    readonly hue: number
    /** The chroma of the accent. */
    readonly chroma: number
    /** The lightness of the accent. */
    readonly lightness: number
    /** The base neutral the surfaces are tinted from. */
    readonly base: number
    /** The font family name. */
    readonly font: string
    /** The corner radius scale name. */
    readonly radius: string
    /** The colour mode the theme forces, or null to follow the viewer. */
    readonly mode: string | null
}

@Entity({ schema: "public", name: "workspaces" })
/** One workspace: the tenant every other row hangs off, and the billing facts support changes by hand. */
export class WorkspaceEntity extends UuidAbstractEntity {
    /** The Auth user who owns the workspace. */
    @Column({ name: "owner_id", type: "uuid" })
    ownerId!: string

    /** The workspace name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The billing status. */
    @Column({ name: "status", type: "text", default: () => "'active'" })
    status!: WorkspaceState

    /** The plan code. */
    @Column({ name: "plan_code", type: "text", nullable: true })
    planCode!: string | null

    /** When the subscription ends. */
    @Column({ name: "paid_until", type: "timestamptz", nullable: true })
    paidUntil!: Date | null

    /** The business type chosen at onboarding. */
    @Column({ name: "business_type", type: "text", nullable: true })
    businessType!: string | null

    /** The usage tier bought on the plan; a bigint, so text. */
    @Column({ name: "tier_credits", type: "bigint", nullable: true })
    tierCredits!: string | null

    /** The seats bought on the plan. */
    @Column({ name: "seat_count", type: "int", nullable: true })
    seatCount!: number | null

    /** The billing cycle. */
    @Column({ name: "billing_cycle", type: "text", nullable: true })
    billingCycle!: "monthly" | "annual" | null

    /** The monthly price billed; a bigint, so text. */
    @Column({ name: "billed_monthly_vnd", type: "bigint", nullable: true })
    billedMonthlyVnd!: string | null

    /** The brand name shown instead of the workspace name. */
    @Column({ name: "display_name", type: "text", nullable: true })
    displayName!: string | null

    /** The brand logo URL (an https address; the picture sits in the public avatars bucket under `workspaces/`). */
    @Column({ name: "logo_url", type: "text", nullable: true })
    logoUrl!: string | null

    /** The IANA time zone in which the workspace's day, week and month begin; the column starts with `Asia/Ho_Chi_Minh`. */
    @Column({ name: "time_zone", type: "text", default: () => "'Asia/Ho_Chi_Minh'" })
    timeZone!: string

    /** The brand theme the workspace chose (hue, chroma, lightness, base, font, radius, optional mode); null wears the NIVO default. */
    @Column({ name: "theme", type: "jsonb", nullable: true })
    theme!: WorkspaceThemeRow | null

    /**
     * The enterprise identifier (`nivo-web`): one unique string an enterprise workspace carries beside its uuid; null for an ordinary
     * workspace. Never selected by default: only the reads that ask for it name it, so no other read of a workspace changes
     * (and the member is absent on a row read without it).
     */
    @Column({ name: "enterprise_key", type: "text", nullable: true, select: false })
    enterpriseKey?: string | null

    /** When the owner deleted the workspace (a soft delete); null while it lives. */
    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null
}
