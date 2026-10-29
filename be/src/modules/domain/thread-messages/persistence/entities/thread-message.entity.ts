import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ApprovalCard, MentionView } from "../../thread-messages.contracts"

/** Who wrote a message. */
export type ThreadAuthorKind = "member" | "agent"

@Entity({ schema: "public", name: "thread_messages" })
/** One line written into a work thread by a member or an agent, with the tags and the approval card it carries. */
export class ThreadMessageEntity {
    /** The message id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread. */
    @Column({ name: "thread_id", type: "uuid" })
    threadId!: string

    /** member or agent. */
    @Column({ name: "author_kind", type: "text" })
    authorKind!: ThreadAuthorKind

    /** The member id (`workspace_members.id`) or the agent id. */
    @Column({ name: "author_id", type: "uuid" })
    authorId!: string

    /** The text. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** The quoted customer words. */
    @Column({ name: "quoted", type: "jsonb", default: () => "'[]'::jsonb" })
    quoted!: ReadonlyArray<string>

    /** The tags with their chip names. */
    @Column({ name: "mentions", type: "jsonb", default: () => "'[]'::jsonb" })
    mentions!: ReadonlyArray<MentionView>

    /** The approval card, or null. */
    @Column({ name: "approval", type: "jsonb", nullable: true })
    approval!: ApprovalCard | null

    /** The approval request the card follows, unique when set. */
    @Column({ name: "approval_request_id", type: "uuid", nullable: true })
    approvalRequestId!: string | null

    /** When it was written. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
