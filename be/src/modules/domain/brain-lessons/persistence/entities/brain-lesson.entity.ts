import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { LessonEvidence } from "../../brain-lessons.contracts"

@Entity({ schema: "public", name: "brain_lessons" })
/** One row of public.brain_lessons. */
export class BrainLessonEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module. */
    @Column({ name: "module", type: "text", nullable: true })
    module!: string | null

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The body. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** The applies when. */
    @Column({ name: "applies_when", type: "text", default: () => "''::text" })
    appliesWhen!: string

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'proposed'::text" })
    status!: "proposed" | "active" | "retired" | "rejected"

    /** The origin. */
    @Column({ name: "origin", type: "text", default: () => "'manual'::text" })
    origin!: "edits" | "note" | "outcome" | "manual"

    /** The evidence. */
    @Column({ name: "evidence", type: "jsonb", default: () => "'[]'::jsonb" })
    evidence!: Array<LessonEvidence>

    /** The version. */
    @Column({ name: "version", type: "int", default: () => "1" })
    version!: number

    /** The supersedes id. */
    @Column({ name: "supersedes_id", type: "uuid", nullable: true })
    supersedesId!: string | null

    /** The proposed by. */
    @Column({ name: "proposed_by", type: "text" })
    proposedBy!: string

    /** The proposed at. */
    @Column({ name: "proposed_at", type: "timestamptz", default: () => "now()" })
    proposedAt!: Date

    /** The decided by. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** The decided at. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null
}
