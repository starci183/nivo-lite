import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { GraphRoad } from "@modules/domain/authority-rules"
import type { DecisionClosedAs, DecisionOutcome, FactValue, GraphMode } from "../../agent-graphs.contracts"

@Entity({ schema: "public", name: "agent_graph_decisions" })
/** What a graph decided for one work item: the version, the path, the facts as read, the branch and the outcome. */
export class AgentGraphDecisionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The work item, one decision per item; null on a run that left no work item. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** What makes a run with no work item one run, or null. */
    @Column({ name: "dedupe_key", type: "text", nullable: true })
    dedupeKey!: string | null

    /** The road it left by. */
    @Column({ name: "road", type: "text", default: "work" })
    road!: GraphRoad

    /** The mode the graph ran in. */
    @Column({ name: "mode", type: "text", default: "shadow" })
    mode!: GraphMode

    /** What the gate answered, or null on a road no gate judges. */
    @Column({ name: "gate_verdict", type: "text", nullable: true })
    gateVerdict!: "auto" | "ask" | null

    /** The facts a condition needed and could not read. */
    @Column({ name: "unread", type: "jsonb", default: () => "'[]'::jsonb" })
    unread!: Array<string>

    /** Why the graph could not judge it, or null. */
    @Column({ name: "unjudged", type: "text", nullable: true })
    unjudged!: string | null

    /** The type of the subject, or null. */
    @Column({ name: "subject_type", type: "text", nullable: true })
    subjectType!: string | null

    /** The id of the subject, or null. */
    @Column({ name: "subject_id", type: "text", nullable: true })
    subjectId!: string | null

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

    /** `auto`, `ask`, `stop` or `divert`. */
    @Column({ name: "outcome", type: "text" })
    outcome!: DecisionOutcome

    /** The approval request a branch ask opened, or null. */
    @Column({ name: "approval_request_id", type: "uuid", nullable: true })
    approvalRequestId!: string | null

    /** How the work came to an end, or null while it is open. */
    @Column({ name: "closed_as", type: "text", nullable: true })
    closedAs!: DecisionClosedAs | null

    /** True when the graph answered differently from the gate alone. */
    @Column({ name: "shadow_diff", type: "boolean", default: false })
    shadowDiff!: boolean
}
