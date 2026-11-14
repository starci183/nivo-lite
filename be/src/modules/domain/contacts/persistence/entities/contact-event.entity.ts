import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_events" })
/** The audit of the contacts, append-only: one row per link, unlink, merge, update, memory forgotten and erasure, with who decided. */
export class ContactEventEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The contact; no foreign key, the audit outlives the erasure it records. */
    @Column({ name: "contact_id", type: "uuid" })
    contactId!: string

    /** What was done. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** Ids and kinds of what changed; never a value of an erased identity. */
    @Column({ name: "detail", type: "jsonb", default: () => "'{}'::jsonb" })
    detail!: object

    /** `member`, `step` or `channel`. */
    @Column({ name: "actor_kind", type: "text" })
    actorKind!: string

    /** The person who decided, when one did. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** The agent of a step's call, or null. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The step key of a step's call, or null. */
    @Column({ name: "step_key", type: "text", nullable: true })
    stepKey!: string | null
}
