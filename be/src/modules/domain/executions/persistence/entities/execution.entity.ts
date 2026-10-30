import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** The decision states of an approval card. */
export type ExecutionStatusLine = "pending_approval" | "approved" | "rejected"

@Entity({ schema: "public", name: "executions" })
/** An approval card of a drafted action. */
export class ExecutionEntity extends UuidAbstractEntity {
    /** The workspace that owns the card. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The responsibility the draft belongs to. */
    @Column({ name: "responsibility_id", type: "uuid" })
    responsibilityId!: string

    /** The agent that wrote the draft, when there is one. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The draft's action kind. */
    @Column({ name: "kind", type: "text", default: () => "'follow_up'" })
    kind!: string

    /** The draft the person approves. */
    @Column({ name: "draft", type: "text" })
    draft!: string

    /** `pending_approval`, `approved` or `rejected`. */
    @Column({ name: "status", type: "text", default: () => "'pending_approval'" })
    status!: ExecutionStatusLine

    /** The person that decided the card, when decided. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** The decision time, when decided. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The work item the card belongs to, when there is one. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null
}
