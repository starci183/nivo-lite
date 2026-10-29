import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "meta_threads" })
/** The window row of one person on one Page. */
export class MetaThreadEntity {
    /** The Page connection. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** `facebook` or `instagram`. */
    @PrimaryColumn({ name: "platform", type: "text" })
    platform!: string

    /** The person on the platform. */
    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string

    /** The person's last message to the Page. */
    @Column({ name: "last_user_at", type: "timestamptz" })
    lastUserAt!: Date
}
