import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "meta_comments" })
/** The private-reply row of one comment. */
export class MetaCommentEntity extends AbstractEntity {
    /** The Page connection. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The comment id on the platform. */
    @PrimaryColumn({ name: "comment_id", type: "text" })
    commentId!: string

    /** `facebook` or `instagram`. */
    @Column({ name: "platform", type: "text" })
    platform!: string

    /** When the comment was made. */
    @Column({ name: "comment_at", type: "timestamptz", nullable: true })
    commentAt!: Date | null

    /** When its one private reply was claimed. */
    @Column({ name: "private_replied_at", type: "timestamptz", nullable: true })
    privateRepliedAt!: Date | null
}
