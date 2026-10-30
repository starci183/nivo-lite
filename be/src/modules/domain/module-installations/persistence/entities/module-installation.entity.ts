import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { InstallationMode, InstallationSettings, InstallationStatus } from "../../module-installations.contracts"

@Entity({ schema: "public", name: "module_installations" })
/** One installed agent of a workspace: one row of `public.module_installations`. */
export class ModuleInstallationEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module key. */
    @Column({ name: "module_key", type: "text" })
    moduleKey!: string

    /** The agent of the instance; null when it has none. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** Where the installation stands. */
    @Column({ name: "status", type: "text", default: () => "'installing'" })
    status!: InstallationStatus

    /** How the agent runs. */
    @Column({ name: "operating_mode", type: "text", default: () => "'assist'" })
    operatingMode!: InstallationMode

    /** True when the agent acts on channels. */
    @Column({ name: "live_enabled", type: "boolean", default: () => "false" })
    liveEnabled!: boolean

    /** The context version in use; null before the first apply. */
    @Column({ name: "active_context_version_id", type: "uuid", nullable: true })
    activeContextVersionId!: string | null

    /** The settings of the instance. */
    @Column({ name: "settings", type: "jsonb", default: () => `'{"processor": "openclaw"}'::jsonb` })
    settings!: InstallationSettings

    /** The label of the instance. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** True when the type allows several instances. */
    @Column({ name: "is_multi", type: "boolean", default: () => "false" })
    isMulti!: boolean

    /** When it was removed for good. */
    @Column({ name: "removed_at", type: "timestamptz", nullable: true })
    removedAt!: Date | null

    /** Who removed it. */
    @Column({ name: "removed_by", type: "text", nullable: true })
    removedBy!: string | null
}
