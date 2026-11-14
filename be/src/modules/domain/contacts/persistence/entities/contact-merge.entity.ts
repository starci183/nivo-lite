import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_merges" })
/** The one redirect of a merged contact: `from` became `into` for a reason; every row keyed by the old id follows it at read time. */
export class ContactMergeEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The contact that went. */
    @Column({ name: "from_contact_id", type: "uuid" })
    fromContactId!: string

    /** The contact that took it over. */
    @Column({ name: "into_contact_id", type: "uuid" })
    intoContactId!: string

    /** Why they are one person. */
    @Column({ name: "reason", type: "text" })
    reason!: string

    /** The person who decided, when one did. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null
}
