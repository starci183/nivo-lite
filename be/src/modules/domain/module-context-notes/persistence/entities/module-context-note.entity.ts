import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { ContextNoteSource, ContextNoteStatus } from "../../context-notes.contracts"

@Entity({ schema: "public", name: "module_context_notes" })
/** A note that supplements the context of an installation later: one row of `public.module_context_notes`. */
export class ModuleContextNoteEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The installation it supplements. */
    @Column({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The fact key the note added to the draft. */
    @Column({ name: "fact_key", type: "text" })
    factKey!: string

    /** The note text. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** Office or the setup chat. */
    @Column({ name: "source", type: "text", default: () => "'office'" })
    source!: ContextNoteSource

    /** Who wrote it. */
    @Column({ name: "author_name", type: "text" })
    authorName!: string

    /** The role they held. */
    @Column({ name: "author_role", type: "text", default: () => "'staff'" })
    authorRole!: string

    /** The user who wrote it, when known. */
    @Column({ name: "author_user_id", type: "uuid", nullable: true })
    authorUserId!: string | null

    /** Where the note stands. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: ContextNoteStatus

    /** The context version that applied the note. */
    @Column({ name: "applied_version", type: "integer", nullable: true })
    appliedVersion!: number | null

    /** Who decided the note. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** When the note was decided. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null
}
