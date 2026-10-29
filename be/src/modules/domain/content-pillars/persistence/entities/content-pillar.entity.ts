import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "content_pillars" })
/** One row of public.content_pillars: a content theme of a workspace. */
export class ContentPillarEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The theme name, unique per workspace. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The description. */
    @Column({ name: "description", type: "text", default: () => "''::text" })
    description!: string

    /** The weight, 0 to 20. */
    @Column({ name: "weight", type: "int", default: () => "1" })
    weight!: number

    /** The display order. */
    @Column({ name: "sort", type: "int", default: () => "0" })
    sort!: number

    /** Whether the theme is in use. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** When the theme was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
