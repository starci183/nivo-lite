import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "nivo_knowledge" })
/** One item of the base knowledge of NIVO, mirrored from the resource files. */
export class NivoKnowledgeItemEntity extends UuidAbstractEntity {
    /** The module folder, or core. */
    @Column({ name: "module", type: "text" })
    module!: string

    /** The stable slug, unique. */
    @Column({ name: "slug", type: "text" })
    slug!: string

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The markdown body. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** The kind of text; the table accepts playbook, authority, escalation, setup_checklist and tone. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The version of the text. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number

    /** The pgvector vector, or null; it is read only by the database, never selected. */
    @Column({ name: "embedding", type: "vector", nullable: true, select: false })
    embedding!: string | null

    /** The search vector the database generates from the title and the body. */
    @Column({ name: "fts", type: "tsvector", nullable: true, select: false, insert: false, update: false })
    fts!: string | null

    /** The model that made the vector, or null. */
    @Column({ name: "embedding_model", type: "text", nullable: true })
    embeddingModel!: string | null
}
