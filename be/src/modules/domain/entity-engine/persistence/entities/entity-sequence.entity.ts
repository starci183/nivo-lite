import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "entity_sequences" })
/** One row of public.entity_sequences: the counter of one sequence field of one workspace in one period. */
export class EntitySequenceEntity extends AbstractEntity {
    /** The owning workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The entity name. */
    @PrimaryColumn({ name: "entity", type: "text" })
    entity!: string

    /** The sequence field name. */
    @PrimaryColumn({ name: "field", type: "text" })
    field!: string

    /** The period the counter belongs to: empty when it never restarts, else a year, month or day key. */
    @PrimaryColumn({ name: "period", type: "text", default: () => "''" })
    period!: string

    /** The last counter value handed out (bigint, read as decimal text). */
    @Column({ name: "value", type: "bigint", default: () => "0" })
    value!: string
}
