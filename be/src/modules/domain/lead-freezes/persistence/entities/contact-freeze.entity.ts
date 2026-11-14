import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_freezes" })
/**
 * The freeze of one person (their contact, else the conversation of a person no contact holds yet): a run of theirs failed for good,
 * so no new run starts for them in any lane until the owner retries the run or skips the turn. One row per person, kept across freezes
 * (`episode` counts them); what reached them while frozen is kept in `pending` and replayed in order on release. `version` fences writes.
 */
export class ContactFreezeEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The person's key: `contact:<id>` or `conversation:<id>`. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The contact, when the person is one. */
    @Column({ name: "contact_id", type: "uuid", nullable: true })
    contactId!: string | null

    /** The conversation, when known. */
    @Column({ name: "route_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** `frozen`, `retrying` or `released`. */
    @Column({ name: "status", type: "text", default: "frozen" })
    status!: string

    /** The run that failed for good. */
    @Column({ name: "frozen_run_id", type: "uuid", nullable: true })
    frozenRunId!: string | null

    /** The agent of that run. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** When it froze. */
    @Column({ name: "frozen_at", type: "timestamptz", nullable: true })
    frozenAt!: Date | null

    /** Why the run failed: the error code. */
    @Column({ name: "frozen_reason", type: "text", nullable: true })
    frozenReason!: string | null

    /** The step it failed on. */
    @Column({ name: "step_key", type: "text", nullable: true })
    stepKey!: string | null

    /** The title of that step, in the owner's language. */
    @Column({ name: "step_title", type: "text", nullable: true })
    stepTitle!: string | null

    /** The person's name, when known. */
    @Column({ name: "customer_name", type: "text", nullable: true })
    customerName!: string | null

    /** The owner's one work item of this freeze. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** How many times this person froze. */
    @Column({ name: "episode", type: "integer", default: () => "0" })
    episode!: number

    /** How many times the run failed in this freeze. */
    @Column({ name: "failures", type: "integer", default: () => "0" })
    failures!: number

    /** The person who took the conversation over, or null. */
    @Column({ name: "held_by", type: "text", nullable: true })
    heldBy!: string | null

    /** When it was released. */
    @Column({ name: "released_at", type: "timestamptz", nullable: true })
    releasedAt!: Date | null

    /** Who released it. */
    @Column({ name: "released_by", type: "text", nullable: true })
    releasedBy!: string | null

    /** `retried` or `skipped`. */
    @Column({ name: "release_reason", type: "text", nullable: true })
    releaseReason!: string | null

    /** The events held while frozen, in order (`{ events }`): opaque to the store. */
    @Column({ name: "pending", type: "jsonb", default: () => "'{\"events\": []}'::jsonb" })
    pending!: object

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
