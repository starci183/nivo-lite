import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MODEL_AMOUNT_FACT } from "./agent-graphs.contracts"
import type { GraphRoad } from "@modules/domain/authority-rules"
import type { ClosedDecision, DecisionClosedAs, DecisionOutcome, FactValue, GraphMode } from "./agent-graphs.contracts"
import { AgentGraphDecisionEntity } from "./persistence/entities"

/** The most closed decisions the learning reads for one agent at a time. */
const LEARN_WINDOW = 200

/** A recorded decision as the approval road reads it. */
export interface DecisionView {
    /** The decision. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The work item. */
    readonly workItemId: string
    /** The version that decided. */
    readonly versionId: string
    /** The action key. */
    readonly action: string
    /** The branch that matched. */
    readonly branchKey: string
    /** The nodes the walk went through. */
    readonly path: ReadonlyArray<string>
    /** The amount the records held, or null. */
    readonly amount: number | null
    /** The request that is open for it, or null. */
    readonly approvalRequestId: string | null
    /** Whether it has ended. */
    readonly closed: boolean
}

/** One run of the graph over a work item, as the trace screen reads it. */
export interface DecisionRun {
    /** The decision. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version that decided. */
    readonly versionId: string
    /** The wake that started the turn, or null. */
    readonly wakeId: string | null
    /** The action key. */
    readonly action: string
    /** The branch that matched. */
    readonly branchKey: string
    /** What the branch did: auto, ask or stop. */
    readonly outcome: string
    /** How the work ended, or null while it is open. */
    readonly closedAs: string | null
    /** True when the graph, in shadow, answered differently from the gate. */
    readonly shadowDiff: boolean
    /** The facts as they were read, with the model amount beside the real one when they differed. */
    readonly facts: Readonly<Record<string, FactValue>>
    /** The request that is open for it, or null. */
    readonly approvalRequestId: string | null
    /** The nodes the walk went through. */
    readonly path: ReadonlyArray<string>
}

/** One run of a graph as the owner lists it: what an agent proposed and what the graph did with it. */
export interface RunEntry {
    /** The run. */
    readonly id: string
    /** The road it left by. */
    readonly road: GraphRoad
    /** The mode the graph ran in. */
    readonly mode: GraphMode
    /** The action key. */
    readonly action: string
    /** The version that decided. */
    readonly versionId: string
    /** The branch that matched, or the node the walk entered at, or nothing when no node holds the action. */
    readonly branchKey: string
    /** What the graph did. */
    readonly outcome: DecisionOutcome
    /** What the gate answered, or null on a road no gate judges. */
    readonly gateVerdict: "auto" | "ask" | null
    /** How the work ended, or null while it is open. */
    readonly closedAs: DecisionClosedAs | null
    /** True when the graph answered differently from the gate alone. */
    readonly differs: boolean
    /** The facts a condition needed and could not read. */
    readonly unread: ReadonlyArray<string>
    /** Why the graph could not judge it, or null. */
    readonly unjudged: string | null
    /** The facts as read. */
    readonly facts: Readonly<Record<string, FactValue>>
    /** The nodes the walk went through. */
    readonly path: ReadonlyArray<string>
    /** The work item, or null on a run that left none. */
    readonly workItemId: string | null
    /** The type of the subject, or null. */
    readonly subjectType: string | null
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** When it ran. */
    readonly createdAt: string
}

/** What a decision records. */
export interface NewDecision {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The work item id, or null on a run that left none. */
    readonly workItemId: string | null
    /** What makes a run with no work item one run, or null. */
    readonly dedupeKey: string | null
    /** The road it left by. */
    readonly road: GraphRoad
    /** The mode the graph ran in. */
    readonly mode: GraphMode
    /** What the gate answered, or null on a road no gate judges. */
    readonly gateVerdict: "auto" | "ask" | null
    /** The version id. */
    readonly versionId: string
    /** The turn id. */
    readonly turnId: string | null
    /** The wake id. */
    readonly wakeId: string | null
    /** The action. */
    readonly action: string
    /** The path. */
    readonly path: ReadonlyArray<string>
    /** The facts. */
    readonly facts: Readonly<Record<string, FactValue>>
    /** The branch key. */
    readonly branchKey: string
    /** The outcome. */
    readonly outcome: DecisionOutcome
    /** The shadow diff. */
    readonly shadowDiff: boolean
    /** The facts a condition needed and could not read. */
    readonly unread: ReadonlyArray<string>
    /** Why the graph could not judge it, or null. */
    readonly unjudged: string | null
    /** The type of the subject, or null. */
    readonly subjectType: string | null
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** How the run closed the work, or null while it stays open. */
    readonly closedAs: DecisionClosedAs | null
}

@Injectable()
/**
 * The decisions of the graphs: one row for each work item, written once however often the item is retried, closed when the item
 * ends, and read back as the evidence the learning counts.
 */
export class AgentGraphDecisionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes the run of an item or a proposal once; a retry gets the id of the row already there. */
    async record(decision: NewDecision): Promise<string> {
        await this.entityManager
            .createQueryBuilder(AgentGraphDecisionEntity, "decision")
            .insert()
            .into(AgentGraphDecisionEntity)
            .values({
                ...decision,
                path: [...decision.path],
                facts: { ...decision.facts },
                unread: [...decision.unread],
            })
            .orIgnore()
            .execute()
        const row = await this.entityManager.findOneByOrFail(
            AgentGraphDecisionEntity,
            decision.workItemId === null
                ? { dedupeKey: decision.dedupeKey ?? "" }
                : { workItemId: decision.workItemId },
        )
        return row.id
    }

    /** The latest runs of an agent, newest first, as the owner lists them. */
    async runsOf(workspaceId: string, agentId: string, limit: number): Promise<ReadonlyArray<RunEntry>> {
        const rows = await this.entityManager.find(AgentGraphDecisionEntity, {
            where: { workspaceId, agentId },
            order: { createdAt: "DESC", id: "DESC" },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            road: row.road,
            mode: row.mode,
            action: row.action,
            versionId: row.versionId,
            branchKey: row.branchKey,
            outcome: row.outcome,
            gateVerdict: row.gateVerdict,
            closedAs: row.closedAs,
            differs: row.shadowDiff,
            unread: row.unread,
            unjudged: row.unjudged,
            facts: row.facts,
            path: row.path,
            workItemId: row.workItemId,
            subjectType: row.subjectType,
            subjectId: row.subjectId,
            createdAt: row.createdAt.toISOString(),
        }))
    }

    /** Closes the decision of an item with how the work ended; an item with no decision, or one already closed, is left alone. */
    async close(workItemId: string, closedAs: DecisionClosedAs): Promise<void> {
        await this.entityManager.update(AgentGraphDecisionEntity, { workItemId, closedAs: IsNull() }, { closedAs })
    }

    /** The decision with this id, or null. */
    async byId(decisionId: string): Promise<DecisionView | null> {
        return this.viewOf(await this.entityManager.findOneBy(AgentGraphDecisionEntity, { id: decisionId }))
    }

    /** The decision whose open request is this one, or null. */
    async byRequest(requestId: string): Promise<DecisionView | null> {
        return this.viewOf(
            await this.entityManager.findOneBy(AgentGraphDecisionEntity, { approvalRequestId: requestId }),
        )
    }

    /** The decision of a work item, or null. */
    async byItem(workItemId: string): Promise<DecisionView | null> {
        return this.viewOf(await this.entityManager.findOneBy(AgentGraphDecisionEntity, { workItemId }))
    }

    /** The agents with a decision that ended since this moment, at most `limit` decisions read. */
    async agentsClosedSince(since: Date, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(AgentGraphDecisionEntity, {
            select: { agentId: true },
            where: { closedAs: Not(IsNull()), updatedAt: MoreThan(since) },
            take: limit,
        })
        return [...new Set(rows.map((row) => row.agentId))]
    }

    /** The run of a work item: what the graph decided for it, or null when it never reached a graph. */
    async runOf(workspaceId: string, workItemId: string): Promise<DecisionRun | null> {
        const row = await this.entityManager.findOneBy(AgentGraphDecisionEntity, { workspaceId, workItemId })
        return row === null
            ? null
            : {
                  id: row.id,
                  workspaceId: row.workspaceId,
                  agentId: row.agentId,
                  versionId: row.versionId,
                  wakeId: row.wakeId,
                  action: row.action,
                  branchKey: row.branchKey,
                  outcome: row.outcome,
                  closedAs: row.closedAs,
                  shadowDiff: row.shadowDiff,
                  facts: row.facts,
                  approvalRequestId: row.approvalRequestId,
                  path: row.path,
              }
    }

    /** Names the request that is open for the decision. */
    async attachRequest(decisionId: string, requestId: string): Promise<void> {
        await this.entityManager.update(AgentGraphDecisionEntity, { id: decisionId }, { approvalRequestId: requestId })
    }

    private viewOf(row: AgentGraphDecisionEntity | null): DecisionView | null {
        const workItemId = row?.workItemId ?? null
        return row === null || workItemId === null
            ? null
            : {
                  id: row.id,
                  workspaceId: row.workspaceId,
                  agentId: row.agentId,
                  workItemId,
                  versionId: row.versionId,
                  action: row.action,
                  branchKey: row.branchKey,
                  path: row.path,
                  amount: amountOf(row.facts),
                  approvalRequestId: row.approvalRequestId,
                  closed: row.closedAs !== null,
              }
    }

    /** The closed decisions of an agent on a branch, oldest first, as the learning reads them: a stop was the graph's own act, and a path no branch took has no boundary to move. */
    async closedOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ClosedDecision>> {
        const rows = await this.entityManager.find(AgentGraphDecisionEntity, {
            where: { workspaceId, agentId },
            order: { createdAt: "DESC" },
            take: LEARN_WINDOW,
        })
        return rows
            .toReversed()
            .flatMap((row) =>
                row.closedAs === null || row.closedAs === "stopped" || row.path[0] === row.branchKey
                    ? []
                    : [{ id: row.id, branchKey: row.branchKey, closedAs: row.closedAs, amount: amountOf(row.facts) }],
            )
    }
}

const amountOf = (facts: Readonly<Record<string, FactValue>>): number | null => {
    const entry = Object.entries(facts).find(
        ([key, value]) => key !== MODEL_AMOUNT_FACT && key.endsWith(".amount_vnd") && typeof value === "number",
    )
    return typeof entry?.[1] === "number" ? entry[1] : null
}
