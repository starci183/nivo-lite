import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "events" })
/** One line of a workspace's append-only evidence log. */
export class EventEntity extends UuidAbstractEntity {
    /** The workspace the line belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The lead the line describes, when there is one. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The event's dotted kind. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The person or agent that performed the action. */
    @Column({ name: "actor", type: "text" })
    actor!: string

    /** The short description of the action. */
    @Column({ name: "summary", type: "text" })
    summary!: string

    /** The evidence behind the action, when present. */
    @Column({ name: "evidence", type: "text", nullable: true })
    evidence!: string | null

    /** The work item the action belongs to, when there is one. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null
}
