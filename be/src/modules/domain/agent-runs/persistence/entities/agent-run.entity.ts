import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentRunStatus } from "../../agent-runs.contracts"

@Entity({ schema: "public", name: "agent_runs" })
/** The durable run of one wake: its status, the trigger intact for a person, and the counter that orders its steps. */
export class AgentRunEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The wake it answers; one run per wake. */
    @Column({ name: "wake_id", type: "uuid" })
    wakeId!: string

    /** The trigger step of the graph. */
    @Column({ name: "trigger", type: "text" })
    trigger!: string

    /** The published version it runs on, or null. */
    @Column({ name: "version_id", type: "uuid", nullable: true })
    versionId!: string | null

    /** Where the run stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'running'" })
    status!: AgentRunStatus

    /** What a person needs when the run dies: the trigger, intact. */
    @Column({ name: "context", type: "jsonb", default: () => "'{}'" })
    context!: object

    /** Why the run stopped, or null. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** When a person was told the run stopped, or null. */
    @Column({ name: "dead_lettered_at", type: "timestamptz", nullable: true })
    deadLetteredAt!: Date | null

    /** When the run ended, or null. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
