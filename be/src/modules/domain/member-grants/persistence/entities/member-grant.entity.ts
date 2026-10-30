import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** What a grant's limit is counted in. */
export type MemberGrantUnit = "vnd" | "percent" | "count"

@Entity({ schema: "public", name: "member_grants" })
/** What one member may approve for one action. */
export class MemberGrantEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member the grant belongs to. */
    @Column({ name: "member_id", type: "uuid" })
    memberId!: string

    /** The action key. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** What the limit is counted in. */
    @Column({ name: "unit", type: "text", default: () => "'vnd'::text" })
    unit!: MemberGrantUnit

    /** The largest amount the member may approve, as exact text; null means no limit. */
    @Column({ name: "max_amount", type: "numeric", nullable: true })
    maxAmount!: string | null
}
