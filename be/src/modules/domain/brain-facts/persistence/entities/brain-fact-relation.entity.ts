import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { RelationKind } from "../../brain-facts.contracts"

@Entity({ schema: "public", name: "brain_fact_relations" })
/** One row of public.brain_fact_relations: an edge of the truth graph between two facts of one workspace. */
export class BrainFactRelationEntity extends UuidAbstractEntity {
    /** The workspace; both facts belong to it (a composite key enforces it). */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The fact the edge starts from. */
    @Column({ name: "from_fact_id", type: "uuid" })
    fromFactId!: string

    /** The fact the edge points at. */
    @Column({ name: "to_fact_id", type: "uuid" })
    toFactId!: string

    /** How the two facts relate. */
    @Column({ name: "kind", type: "text" })
    kind!: RelationKind

    /** The relation in people's words, or null. */
    @Column({ name: "label", type: "text", nullable: true })
    label!: string | null

    /** Who made it. */
    @Column({ name: "created_by", type: "text" })
    createdBy!: string
}
