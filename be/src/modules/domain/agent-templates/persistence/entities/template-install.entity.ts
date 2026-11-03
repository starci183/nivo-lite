import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "template_installs" })
/** What an installation took from a template: the version it stands on and the values its buyer gave. */
export class TemplateInstallEntity extends AbstractEntity {
    /** The installation. */
    @PrimaryColumn({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The version installed. */
    @Column({ name: "version", type: "integer" })
    version!: number

    /** The values the buyer gave, by parameter key. */
    @Column({ name: "parameter_values", type: "jsonb", default: () => "'{}'::jsonb" })
    parameterValues!: Record<string, number | string | boolean>

    /** The license. */
    @Column({ name: "license_id", type: "uuid", nullable: true })
    licenseId!: string | null

    /** Who installed it. */
    @Column({ name: "installed_by", type: "uuid", nullable: true })
    installedBy!: string | null
}
