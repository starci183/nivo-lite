import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** Where a lead stands on its journey. */
export type LeadStage = "new" | "qualified" | "proposal" | "won" | "lost"

@Entity({ schema: "public", name: "leads" })
/** One customer of a workspace, captured from a conversation, an API call or a campaign. */
export class LeadEntity extends UuidAbstractEntity {
    /** The workspace that owns the lead. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The name of the contact. */
    @Column({ name: "contact_name", type: "text" })
    contactName!: string

    /** The company of the contact. */
    @Column({ name: "company", type: "text" })
    company!: string

    /** The channel the lead came through. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** What the customer needs. */
    @Column({ name: "need", type: "text" })
    need!: string

    /** Where the lead stands on its journey. */
    @Column({ name: "stage", type: "text", default: () => "'new'::text" })
    stage!: LeadStage

    /** The context brief of the customer. */
    @Column({ name: "context_summary", type: "text", nullable: true })
    contextSummary!: string | null

    /** The normalised phone. */
    @Column({ name: "phone", type: "text", nullable: true })
    phone!: string | null

    /** The email. */
    @Column({ name: "email", type: "text", nullable: true })
    email!: string | null

    /** The module installation (an id of the modules capability) that captured the lead. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null
}
