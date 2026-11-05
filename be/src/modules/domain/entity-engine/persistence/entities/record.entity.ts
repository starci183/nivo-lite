import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "records" })
/** One row of public.records: a record of a declared entity, partitioned by `entity`; declared fields live in `data`. */
export class RecordEntity extends AbstractEntity {
    /** The entity name (`<module>.<thing>`), the partition key. */
    @PrimaryColumn({ name: "entity", type: "text" })
    entity!: string

    /** The record id. */
    @PrimaryColumn({ name: "id", type: "uuid" })
    id!: string

    /** The owning workspace; row-level security compares it with the engine scope. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The declared fields of the record. */
    @Column({ name: "data", type: "jsonb", default: () => "'{}'::jsonb" })
    data!: Record<string, unknown>

    /** The version token, bumped by every write (bigint, read as decimal text). */
    @Column({ name: "version", type: "bigint", default: () => "1" })
    version!: string
}
