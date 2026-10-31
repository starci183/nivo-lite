import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** Where a dossier stands; the table holds it under a CHECK. */
export type BrainDossierStatus = "present" | "partial" | "drafted" | "missing" | "template"

@Entity({ schema: "public", name: "brain_dossiers" })
/** One dossier a workspace tracks: a row of public.brain_dossiers. */
export class BrainDossierEntity extends UuidAbstractEntity {
    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The category: the top folder of its documents without its number, the same label as the `topic` of those documents. */
    @Column({ name: "category", type: "text" })
    category!: string

    /** The number the category carries in its folder name; categories are listed by it. */
    @Column({ name: "category_order", type: "smallint" })
    categoryOrder!: number

    /** Where the dossier sits among all of the workspace. */
    @Column({ name: "position", type: "smallint" })
    position!: number

    /** The reference documents name it by (the number in front of their title), unique per workspace. */
    @Column({ name: "ref", type: "text" })
    ref!: string

    /** The dossier's name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** Where it stands. */
    @Column({ name: "status", type: "text" })
    status!: BrainDossierStatus

    /** The documents already held, as the checklist words them. */
    @Column({ name: "existing", type: "text", nullable: true })
    existing!: string | null

    /** What is still missing or to be done. */
    @Column({ name: "missing", type: "text", nullable: true })
    missing!: string | null

    /** The drafts and registers already written. */
    @Column({ name: "drafts", type: "text", nullable: true })
    drafts!: string | null
}
