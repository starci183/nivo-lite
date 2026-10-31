import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { DecisionClosedAs, FactValue } from "../../agent-graphs.contracts"

@Entity({ schema: "public", name: "agent_graph_decisions" })
/** What a graph decided for one work item: the version, the path, the facts as read, the branch and the outcome. */
export class AgentGraphDecisionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The work item; one decision per item. */
    @Column({ name: "work_item_id", type: "uuid" })
    workItemId!: string

    /** The version that decided. */
    @Column({ name: "version_id", type: "uuid" })
    versionId!: string

    /** The turn that asked, or null. No foreign key: turns go at 30 days. */
    @Column({ name: "turn_id", type: "uuid", nullable: true })
    turnId!: string | null

    /** The wake that started the turn, or null. */
    @Column({ name: "wake_id", type: "uuid", nullable: true })
    wakeId!: string | null

    /** The action key. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** The keys of the nodes the work went through. */
    @Column({ name: "path", type: "jsonb", default: () => "'[]'::jsonb" })
    path!: Array<string>

    /** The facts as read from real records. */
    @Column({ name: "facts", type: "jsonb", default: () => "'{}'::jsonb" })
    facts!: Record<string, FactValue>

    /** The branch that matched. */
    @Column({ name: "branch_key", type: "text" })
    branchKey!: string

    /** `auto`, `ask` or `stop`. */
    @Column({ name: "outcome", type: "text" })
    outcome!: "auto" | "ask" | "stop"

    /** The approval request a branch ask opened, or null. */
    @Column({ name: "approval_request_id", type: "uuid", nullable: true })
    approvalRequestId!: string | null

    /** How the work came to an end, or null while it is open. */
    @Column({ name: "closed_as", type: "text", nullable: true })
    closedAs!: DecisionClosedAs | null

    /** True when the graph, in shadow, would have answered differently from the gate. */
    @Column({ name: "shadow_diff", type: "boolean", default: false })
    shadowDiff!: boolean
}
