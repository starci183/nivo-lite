import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Where a question gap stands. */
export type KnowledgeGapStatus = "open" | "answered" | "dismissed"

@Entity({ schema: "public", name: "knowledge_gaps" })
/** A question customers asked that the brain could not answer. */
export class KnowledgeGapEntity {
    /** The gap. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that asked. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent that could not answer. */
    @Column({ name: "module", type: "text" })
    module!: string

    /** The question as first asked. */
    @Column({ name: "question", type: "text" })
    question!: string

    /** The normalised question. */
    @Column({ name: "question_key", type: "text" })
    questionKey!: string

    /** The significant words. */
    @Column({ name: "keywords", type: "text", array: true, default: () => "'{}'::text[]" })
    keywords!: Array<string>

    /** The subject guess. */
    @Column({ name: "topic", type: "text", nullable: true })
    topic!: string | null

    /** The attribute guess. */
    @Column({ name: "attribute_guess", type: "text", nullable: true })
    attributeGuess!: string | null

    /** How many times it was asked. */
    @Column({ name: "count", type: "integer", default: () => "1" })
    count!: number

    /** First asked. */
    @Column({ name: "first_seen_at", type: "timestamptz", default: () => "now()" })
    firstSeenAt!: Date

    /** Last asked. */
    @Column({ name: "last_seen_at", type: "timestamptz", default: () => "now()" })
    lastSeenAt!: Date

    /** One conversation that asked it. */
    @Column({ name: "example_conversation_id", type: "uuid", nullable: true })
    exampleConversationId!: string | null

    /** `model` or `retrieval`. */
    @Column({ name: "source", type: "text", default: () => "'retrieval'::text" })
    source!: "model" | "retrieval"

    /** open, answered or dismissed. */
    @Column({ name: "status", type: "text", default: () => "'open'::text" })
    status!: KnowledgeGapStatus

    /** When it was answered. */
    @Column({ name: "answered_at", type: "timestamptz", nullable: true })
    answeredAt!: Date | null

    /** What answered it. */
    @Column({ name: "answered_by", type: "text", nullable: true })
    answeredBy!: string | null

    /** When it was dismissed. */
    @Column({ name: "dismissed_at", type: "timestamptz", nullable: true })
    dismissedAt!: Date | null

    /** Who dismissed it. */
    @Column({ name: "dismissed_by", type: "text", nullable: true })
    dismissedBy!: string | null

    /** Times asked again after an answer. */
    @Column({ name: "reopened_count", type: "integer", default: () => "0" })
    reopenedCount!: number

    /** The last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
