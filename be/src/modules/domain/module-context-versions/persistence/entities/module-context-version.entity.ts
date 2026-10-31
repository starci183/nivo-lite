import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { VersionSnapshot } from "../../module-context-versions.contracts"

@Entity({ schema: "public", name: "module_context_versions" })
/** One applied, immutable context version of an installation: one row of `public.module_context_versions`. */
export class ModuleContextVersionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The installation. */
    @Column({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The number of the version, from 1. */
    @Column({ name: "version", type: "integer" })
    version!: number

    /** What was frozen. */
    @Column({ name: "snapshot", type: "jsonb" })
    snapshot!: VersionSnapshot

    /** Who applied it. */
    @Column({ name: "applied_by", type: "text", default: () => "''" })
    appliedBy!: string

    /** When it was applied. */
    @Column({ name: "applied_at", type: "timestamptz", default: () => "now()" })
    appliedAt!: Date
}
