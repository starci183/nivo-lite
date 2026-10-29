import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "knowledge_suggestion_state" })
/** What a workspace decided about one knowledge suggestion. */
export class KnowledgeSuggestionStateEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The key of the suggestion. */
    @PrimaryColumn({ name: "suggestion_key", type: "text" })
    suggestionKey!: string

    /** `dismissed` or `not_applicable`. */
    @Column({ name: "state", type: "text" })
    state!: string

    /** Who decided. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When the decision was made. */
    @Column({ name: "decided_at", type: "timestamptz", default: () => "now()" })
    decidedAt!: Date
}
