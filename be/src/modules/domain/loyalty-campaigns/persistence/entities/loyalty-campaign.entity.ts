import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Where a promotion campaign stands. */
export type LoyaltyCampaignStatus =
    "draft" | "waiting" | "waiting_decision" | "sending" | "done" | "rejected" | "failed"

@Entity({ schema: "public", name: "loyalty_campaigns" })
/** One promotion to a segment of the programme. */
export class LoyaltyCampaignEntity {
    /** The campaign. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** Owner-supplied name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The stored segment. */
    @Column({ name: "segment", type: "jsonb", default: () => "'{}'::jsonb" })
    segment!: object

    /** The customer message. */
    @Column({ name: "draft", type: "text", default: () => "''::text" })
    draft!: string

    /** The workflow status. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: LoyaltyCampaignStatus

    /** The decision that approves it, when there is one. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The intended recipients. */
    @Column({ name: "recipients", type: "integer", default: () => "0" })
    recipients!: number

    /** How long the draft took, in milliseconds. */
    @Column({ name: "draft_ms", type: "integer", nullable: true })
    draftMs!: number | null

    /** The requester's display name. */
    @Column({ name: "created_by", type: "text", default: () => "''::text" })
    createdBy!: string

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The terminal time. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
