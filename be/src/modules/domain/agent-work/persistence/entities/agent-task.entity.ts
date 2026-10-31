import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentTaskStatus, AgentTaskWaitingOn } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_tasks" })
/** The agent's own to-do. It points at the work item it opened and never repeats it; the key is the agent's own name for the task. */
export class AgentTaskEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The goal it serves, or null. */
    @Column({ name: "goal_id", type: "uuid", nullable: true })
    goalId!: string | null

    /** The agent's key for the task: unique per agent. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** Short title, up to 200 characters. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Longer text, up to 2000 characters. */
    @Column({ name: "detail", type: "text", default: () => "''" })
    detail!: string

    /** Where the task stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'open'" })
    status!: AgentTaskStatus

    /** What a waiting task waits for, or null. */
    @Column({ name: "waiting_on", type: "text", nullable: true })
    waitingOn!: AgentTaskWaitingOn | null

    /** When the agent asked to be woken for it, or null. */
    @Column({ name: "next_action_at", type: "timestamptz", nullable: true })
    nextActionAt!: Date | null

    /** The work item it opened, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The wake whose turn opened it, or null. */
    @Column({ name: "origin_wake_id", type: "uuid", nullable: true })
    originWakeId!: string | null

    /** When it was closed, or null. */
    @Column({ name: "done_at", type: "timestamptz", nullable: true })
    doneAt!: Date | null
}
