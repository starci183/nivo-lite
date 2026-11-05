import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "record_links" })
/** One row of public.record_links: a relation between two records of one workspace. */
export class RecordLinkEntity {
    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The entity of the record the relation starts at. */
    @PrimaryColumn({ name: "from_entity", type: "text" })
    fromEntity!: string

    /** The record the relation starts at. */
    @PrimaryColumn({ name: "from_id", type: "uuid" })
    fromId!: string

    /** The relation name declared on the source entity. */
    @PrimaryColumn({ name: "relation", type: "text" })
    relation!: string

    /** The entity of the record the relation points at. */
    @PrimaryColumn({ name: "to_entity", type: "text" })
    toEntity!: string

    /** The record the relation points at. */
    @PrimaryColumn({ name: "to_id", type: "uuid" })
    toId!: string
}
