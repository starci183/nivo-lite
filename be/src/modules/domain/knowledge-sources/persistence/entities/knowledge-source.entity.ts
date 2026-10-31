import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** Where a knowledge source stands; the table holds it under a CHECK. */
export type KnowledgeSourceStatus =
    "pending" | "queued" | "reading" | "indexing" | "extracting_facts" | "ready" | "failed" | "blocked_credits"

@Entity({ schema: "public", name: "knowledge_sources" })
/** One document or link a workspace taught its agents: a row of public.knowledge_sources. */
export class KnowledgeSourceEntity extends UuidAbstractEntity {
    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module (agent type) the document is for; null = every module. */
    @Column({ name: "module", type: "text", nullable: true })
    module!: string | null

    /** text, faq, file or url. */
    @Column({ name: "kind", type: "text" })
    kind!: "text" | "faq" | "file" | "url"

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The text (the address of a link source until the worker replaces it). */
    @Column({ name: "content", type: "text", default: () => "''::text" })
    content!: string

    /** Where the source stands. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: KnowledgeSourceStatus

    /** A stored code or note, or null. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** How many passages are stored. */
    @Column({ name: "chunk_count", type: "integer", default: () => "0" })
    chunkCount!: number

    /** Who added it; null for an API key. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** The topic label. */
    @Column({ name: "topic", type: "text", nullable: true })
    topic!: string | null

    /** The tags. */
    @Column({ name: "tags", type: "text", array: true, default: () => "'{}'::text[]" })
    tags!: Array<string>

    /** public or internal. */
    @Column({ name: "visibility", type: "text", default: () => "'internal'::text" })
    visibility!: "public" | "internal"

    /** The agent instance the document is kept for; null = every instance. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The storage object of a file source. */
    @Column({ name: "storage_path", type: "text", nullable: true })
    storagePath!: string | null

    /** The address of a link source. */
    @Column({ name: "source_url", type: "text", nullable: true })
    sourceUrl!: string | null

    /** Where it came from. */
    @Column({ name: "origin", type: "text", nullable: true })
    origin!: string | null

    /** The raw bytes it holds: the uploaded file, or the pasted text. */
    @Column({ name: "size_bytes", type: "integer", default: () => "0" })
    sizeBytes!: number

    /** 0-100 while a worker is on it. */
    @Column({ name: "progress", type: "integer", default: () => "0" })
    progress!: number

    /** The stage the worker is on while it works (read, chunk, embed, store or facts); null when no worker is on it. */
    @Column({ name: "stage", type: "text", nullable: true })
    stage!: "read" | "chunk" | "embed" | "store" | "facts" | null

    /** How many passages of the stage are done (the embed stage: passages with their vector); null when the stage has no count. */
    @Column({ name: "stage_done", type: "integer", nullable: true })
    stageDone!: number | null

    /** How many passages the stage has in all; null when the stage has no count. */
    @Column({ name: "stage_total", type: "integer", nullable: true })
    stageTotal!: number | null

    /** The SHA-256 of the text whose passages and facts are complete; null while the work on the text is unfinished. */
    @Column({ name: "content_hash", type: "text", nullable: true })
    contentHash!: string | null
}
