import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentTemplatePackage } from "../../agent-templates.contracts"

@Entity({ schema: "public", name: "agent_template_versions" })
/** One frozen version of a template. The application role may only read and insert it, so the database refuses a change. */
export class AgentTemplateVersionEntity extends UuidAbstractEntity {
    /** The template. */
    @Column({ name: "template_id", type: "uuid" })
    templateId!: string

    /** The key of the template. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The number of the version within the template. */
    @Column({ name: "version", type: "integer" })
    version!: number

    /** The frozen package. */
    @Column({ name: "package", type: "jsonb" })
    package!: AgentTemplatePackage

    /** The hash of the package. */
    @Column({ name: "hash", type: "text" })
    hash!: string

    /** What changed since the version before. */
    @Column({ name: "changelog", type: "text", default: () => "''" })
    changelog!: string

    /** True when the buyer must read the version before taking it. */
    @Column({ name: "breaking", type: "boolean", default: false })
    breaking!: boolean

    /** Who packaged it. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
