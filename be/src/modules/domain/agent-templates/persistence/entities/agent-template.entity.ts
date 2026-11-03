import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { TemplateText } from "../../agent-templates.contracts"

@Entity({ schema: "public", name: "agent_templates" })
/** One template of a creator: the key its versions share. */
export class AgentTemplateEntity extends UuidAbstractEntity {
    /** The key, unique across the marketplace. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The account of the creator. */
    @Column({ name: "creator_account_id", type: "uuid" })
    creatorAccountId!: string

    /** The module the template stands on. */
    @Column({ name: "base_module", type: "text" })
    baseModule!: string

    /** The name on the card. */
    @Column({ name: "name", type: "jsonb" })
    name!: TemplateText

    /** The workspace the template was packaged from, or null once it is gone. */
    @Column({ name: "source_workspace_id", type: "uuid", nullable: true })
    sourceWorkspaceId!: string | null

    /** True for a template of the platform itself. */
    @Column({ name: "first_party", type: "boolean", default: false })
    firstParty!: boolean

    /** The key of the template this one was forked from, or null. */
    @Column({ name: "forked_from", type: "text", nullable: true })
    forkedFrom!: string | null
}
