import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { OfferStatus } from "../../hiring.contracts"

/** The terms column as stored. */
export interface HiringOfferTerms {
    /** The position. */
    readonly title?: string
    /** The pay. */
    readonly pay?: string
    /** The start date. */
    readonly start_date?: string
    /** The probation. */
    readonly probation?: string
    /** A free note. */
    readonly note?: string
}

@Entity({ schema: "public", name: "hiring_offers" })
/** One offer letter to a candidate: the terms, the draft, the decision behind it and the answer. */
export class HiringOfferEntity extends UuidAbstractEntity {
    /** The workspace the offer belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The candidate. */
    @Column({ name: "candidate_id", type: "uuid" })
    candidateId!: string

    /** The job. */
    @Column({ name: "job_id", type: "uuid" })
    jobId!: string

    /** The offer terms. */
    @Column({ name: "terms", type: "jsonb", default: () => "'{}'::jsonb" })
    terms!: HiringOfferTerms | null

    /** The letter. */
    @Column({ name: "draft", type: "text", default: () => "''::text" })
    draft!: string

    /** Where the offer stands. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: OfferStatus

    /** The public answer token. */
    @Column({ name: "token", type: "text" })
    token!: string

    /** The decision the sending waits on, when it does. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** How it was sent. */
    @Column({ name: "sent_via", type: "text", nullable: true })
    sentVia!: "email" | "chat" | "manual" | null

    /** When it was sent. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null

    /** When the offer lapses. */
    @Column({ name: "expires_at", type: "timestamptz", nullable: true })
    expiresAt!: Date | null

    /** When the candidate answered. */
    @Column({ name: "responded_at", type: "timestamptz", nullable: true })
    respondedAt!: Date | null

    /** The user who created the offer. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
