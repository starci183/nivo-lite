import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "brain_source_profiles" })
/** One row of public.brain_source_profiles: how one connection's entity maps into the brain, and how far it is trusted. */
export class BrainSourceProfileEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connection the source is read through. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The entity of the connection the profile describes. */
    @Column({ name: "entity", type: "text" })
    entity!: string

    /** The map from the source's fields to the brain's. */
    @Column({ name: "field_map", type: "jsonb", default: () => "'{}'::jsonb" })
    fieldMap!: unknown

    /** The trust placed in the source, 0 to 100. */
    @Column({ name: "trust", type: "smallint", default: () => "60" })
    trust!: number

    /** The profile status, a member of the table check. */
    @Column({ name: "status", type: "text", default: () => "'draft'" })
    status!: "draft" | "confirmed"

    /** The sample rows the profile was drawn from. */
    @Column({ name: "sample", type: "jsonb", default: () => "'[]'::jsonb" })
    sample!: unknown

    /** The notes on the profile. */
    @Column({ name: "notes", type: "text", default: () => "''" })
    notes!: string

    /** Who confirmed the profile, or null. */
    @Column({ name: "confirmed_by", type: "text", nullable: true })
    confirmedBy!: string | null

    /** When the profile was confirmed, or null. */
    @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
    confirmedAt!: Date | null
}
