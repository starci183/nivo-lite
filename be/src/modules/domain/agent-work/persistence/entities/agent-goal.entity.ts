import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentGoalSource, AgentGoalStatus } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_goals" })
/** What an owner, a module or the agent itself wants the agent to keep working toward. */
export class AgentGoalEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** Short title, up to 200 characters. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Longer text, up to 2000 characters. */
    @Column({ name: "detail", type: "text", default: () => "''" })
    detail!: string

    /** Where the goal stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'active'" })
    status!: AgentGoalStatus

    /** Who put it there; constrained by a CHECK. */
    @Column({ name: "source", type: "text", default: () => "'owner'" })
    source!: AgentGoalSource

    /** The member who wrote it, or null. */
    @Column({ name: "created_by_member", type: "uuid", nullable: true })
    createdByMember!: string | null

    /** When it is due, or null. */
    @Column({ name: "due_at", type: "timestamptz", nullable: true })
    dueAt!: Date | null

    /** When the agent last reviewed it, or null. */
    @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
    reviewedAt!: Date | null
}
