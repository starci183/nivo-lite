import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Who wrote a line of the Office thread. */
export type MessageAuthorKind = "human" | "agent" | "system"

@Entity({ schema: "public", name: "messages" })
/** One line of a workspace's team chat and Office thread. */
export class MessageEntity {
    /** The line. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace whose chat holds it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `human`, `agent` or `system`. */
    @Column({ name: "author_kind", type: "text" })
    authorKind!: MessageAuthorKind

    /** The author's display name. */
    @Column({ name: "author_name", type: "text" })
    authorName!: string

    /** The agent that wrote it, when one did. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The text. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** The customer it is about. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The work item it mirrors. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The staff member it was written as, or null for the owner. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The Hub room it was posted in; null is routed by the database. */
    @Column({ name: "room", type: "text", nullable: true })
    room!: string | null

    /** The result card payload, when the line carries one. */
    @Column({ name: "card", type: "jsonb", nullable: true })
    card!: object | null

    /** The account that wrote it, when a member did. */
    @Column({ name: "author_user_id", type: "uuid", nullable: true })
    authorUserId!: string | null
}
