import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_graphs" })
/**
 * The graph of one agent: the draft the editor changes, the version that decides and whether it decides (`enforced`) or only records
 * (`shadow`). One row per agent; `version` is the fence of every write.
 */
export class AgentGraphEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The installation the agent runs as. */
    @Column({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The draft the editor changes, not yet parsed with the document schema. */
    @Column({ name: "draft", type: "jsonb" })
    draft!: object

    /** The revision of the draft. */
    @Column({ name: "draft_rev", type: "integer" })
    draftRev!: number

    /** The version that decides, or null before the first. */
    @Column({ name: "active_version_id", type: "uuid", nullable: true })
    activeVersionId!: string | null

    /** `shadow` or `enforced`. */
    @Column({ name: "mode", type: "text" })
    mode!: string

    /** The member who last set the mode, or null. */
    @Column({ name: "mode_set_by", type: "uuid", nullable: true })
    modeSetBy!: string | null

    /** When they did, or null. */
    @Column({ name: "mode_set_at", type: "timestamptz", nullable: true })
    modeSetAt!: Date | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
