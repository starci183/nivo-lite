import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "website_sites" })
/** The website intake of a workspace: the public key its form posts under, what the site shows and the agent that receives the customers. */
export class WebsiteSiteEntity extends UuidAbstractEntity {
    /** The workspace; it has at most one website intake. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The public key in the address the form posts to; it names no secret. */
    @Column({ name: "site_key", type: "text" })
    siteKey!: string

    /** The owner switched the intake on. */
    @Column({ name: "is_enabled", type: "boolean", default: () => "false" })
    isEnabled!: boolean

    /** The site shows the chat button. */
    @Column({ name: "chat_enabled", type: "boolean", default: () => "true" })
    chatEnabled!: boolean

    /** The site shows the hosted form; off refuses every submission. */
    @Column({ name: "form_enabled", type: "boolean", default: () => "true" })
    formEnabled!: boolean

    /** The site shows the price list. */
    @Column({ name: "prices_enabled", type: "boolean", default: () => "false" })
    pricesEnabled!: boolean

    /** The agent that receives the customers, or null before the owner picks one. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null
}
