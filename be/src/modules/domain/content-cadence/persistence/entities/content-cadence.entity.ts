import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "content_cadence" })
/** One row of public.content_cadence. */
export class ContentCadenceEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The channel. */
    @Column({ name: "channel", type: "text" })
    channel!: "facebook" | "zalo" | "tiktok" | "instagram"

    /** The posts per week. */
    @Column({ name: "posts_per_week", type: "int", default: () => "3" })
    postsPerWeek!: number

    /** The days. */
    @Column({ name: "days", type: "int", array: true, default: () => "'{}'::integer[]" })
    days!: Array<number>

    /** The post time. */
    @Column({ name: "post_time", type: "text", default: () => "'19:30'::text" })
    postTime!: string

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
