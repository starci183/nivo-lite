import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "public_document_sources" })
/** One internal document a public document was drafted from, with the hash of its text at the time, so a later change is seen. */
export class PublicDocumentSourceEntity extends AbstractEntity {
    /** The public document. */
    @PrimaryColumn({ name: "document_id", type: "uuid" })
    documentId!: string

    /** The internal document; it carries no foreign key, so a deleted one still shows as changed. */
    @PrimaryColumn({ name: "source_id", type: "uuid" })
    sourceId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** Its title when it was recorded. */
    @Column({ name: "source_title", type: "text" })
    sourceTitle!: string

    /** The hash of its text when it was recorded. */
    @Column({ name: "content_hash", type: "text" })
    contentHash!: string
}
