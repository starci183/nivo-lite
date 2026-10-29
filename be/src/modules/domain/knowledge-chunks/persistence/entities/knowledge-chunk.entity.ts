import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "knowledge_chunks" })
/** One passage of a knowledge source, with its vector for similarity search. */
export class KnowledgeChunkEntity {
    /** The passage id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The source the passage was cut from. */
    @Column({ name: "source_id", type: "uuid" })
    sourceId!: string

    /** The module the source belongs to, or null. */
    @Column({ name: "module", type: "text", nullable: true })
    module!: string | null

    /** The order of the passage in its source. */
    @Column({ name: "ord", type: "integer" })
    ord!: number

    /** The text. */
    @Column({ name: "content", type: "text" })
    content!: string

    /** The pgvector vector, or null; it is read only by the database, never selected. */
    @Column({ name: "embedding", type: "vector", nullable: true, select: false })
    embedding!: string | null

    /** The search vector the database generates from the text. */
    @Column({ name: "fts", type: "tsvector", nullable: true, select: false, insert: false, update: false })
    fts!: string | null

    /** When the passage was stored. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** Who may see the passage: public or internal (the table checks it). */
    @Column({ name: "visibility", type: "text", default: () => "'internal'::text" })
    visibility!: string

    /** The model that made the vector, or null. */
    @Column({ name: "embedding_model", type: "text", nullable: true })
    embeddingModel!: string | null

    /** The agent instance the source is kept for, or null for every instance. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null
}
