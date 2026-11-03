import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"
import type { GraphMode } from "../../agent-graphs.contracts"

@Entity({ schema: "public", name: "agent_graphs" })
/** The graph of one agent: its draft under a revision check, its active version and whether it decides or only records. */
export class AgentGraphEntity extends AbstractEntity {
    /** The agent. */
    @PrimaryColumn({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The installation the agent runs as. */
    @Column({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The draft the editor changes; every read of it is parsed by `graphDocumentSchema`. */
    @Column({ name: "draft", type: "jsonb" })
    draft!: object

    /** The revision of the draft; a save names the revision it read. */
    @Column({ name: "draft_rev", type: "integer", default: 1 })
    draftRev!: number

    /** The version that decides, or null before the first. */
    @Column({ name: "active_version_id", type: "uuid", nullable: true })
    activeVersionId!: string | null

    /** `enforced` decides; `shadow` records only, and only the owner sets it. */
    @Column({ name: "mode", type: "text", default: () => "'enforced'" })
    mode!: GraphMode

    /** The owner who last set the mode, or null when nobody ever did. */
    @Column({ name: "mode_set_by", type: "uuid", nullable: true })
    modeSetBy!: string | null

    /** When they did, or null. */
    @Column({ name: "mode_set_at", type: "timestamptz", nullable: true })
    modeSetAt!: Date | null
}
