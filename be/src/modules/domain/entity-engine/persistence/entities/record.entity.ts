import { AbstractEntity } from "@modules/platform/database"
import { Column, DeleteDateColumn, Entity, PrimaryColumn } from "typeorm"

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

    /**
     * The agent (`agents.id`) the record belongs to, stamped by the engine from the scope that inserted it (never a declared field or a
     * value of a call). No record exists without one: the engine refuses an unscoped write (`AgentMissing`), and every record partition
     * carries `agent_id IS NOT NULL` and a foreign key to the agents with ON DELETE CASCADE. An agent's
     * own tools reach only its own.
     */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The declared fields of the record. */
    @Column({ name: "data", type: "jsonb", default: () => "'{}'::jsonb" })
    data!: Record<string, unknown>

    /** The version token, bumped by every write (bigint, read as decimal text). */
    @Column({ name: "version", type: "bigint", default: () => "1" })
    version!: string

    /**
     * When the record was soft-deleted, or null while it lives (owner order 2026-11-14: a record is never hard-deleted). A delete sets it
     * and bumps `version`; this column is the entity's delete-date column, so every find and every query builder over `records` (and every
     * join to it) leaves a deleted record out unless a caller asks `withDeleted`. Nothing in the engine does.
     */
    @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null
}
