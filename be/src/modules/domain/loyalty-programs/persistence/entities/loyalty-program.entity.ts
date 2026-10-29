import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "loyalty_programs" })
/** The loyalty programme of one workspace. */
export class LoyaltyProgramEntity {
    /** The workspace that runs the programme. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The slug of the public points page. */
    @Column({ name: "slug", type: "text" })
    slug!: string

    /** The name of the programme. */
    @Column({ name: "name", type: "text", default: () => "''::text" })
    name!: string

    /** Whether the programme is on. */
    @Column({ name: "enabled", type: "boolean", default: () => "true" })
    enabled!: boolean

    /** The stored rules, as the owner saved them. */
    @Column({ name: "config", type: "jsonb", default: () => "'{}'::jsonb" })
    config!: object

    /** When the programme was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
