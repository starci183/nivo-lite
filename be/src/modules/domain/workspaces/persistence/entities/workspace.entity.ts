import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** The billing states the table checks. */
export type WorkspaceState = "pending_payment" | "active" | "past_due" | "cancelled"

@Entity({ schema: "public", name: "workspaces" })
/** One workspace: the tenant every other row hangs off, and the billing facts support changes by hand. */
export class WorkspaceEntity {
    /** The workspace id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The Auth user who owns the workspace. */
    @Column({ name: "owner_id", type: "uuid" })
    ownerId!: string

    /** The workspace name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** When the workspace was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

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

    /** The brand logo URL. */
    @Column({ name: "logo_url", type: "text", nullable: true })
    logoUrl!: string | null
}
