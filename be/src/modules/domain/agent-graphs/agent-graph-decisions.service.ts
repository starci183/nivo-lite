import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MODEL_AMOUNT_FACT } from "./agent-graphs.contracts"
import type { ClosedDecision, DecisionClosedAs, FactValue } from "./agent-graphs.contracts"
import { AgentGraphDecisionEntity } from "./persistence/entities"

/** The most closed decisions the learning reads for one agent at a time. */
const LEARN_WINDOW = 200

/** What a decision records. */
export interface DecisionRecord {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The work item id. */
    readonly workItemId: string
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
    readonly outcome: "auto" | "ask" | "stop"
    /** The shadow diff. */
    readonly shadowDiff: boolean
}

@Injectable()
/**
 * The decisions of the graphs: one row for each work item, written once however often the item is retried, closed when the item
 * ends, and read back as the evidence the learning counts.
 */
export class AgentGraphDecisionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes the decision of an item once; a retry gets the id of the row already there. */
    async record(decision: DecisionRecord): Promise<string> {
        await this.entityManager
            .createQueryBuilder(AgentGraphDecisionEntity, "decision")
            .insert()
            .into(AgentGraphDecisionEntity)
            .values({ ...decision, path: [...decision.path], facts: { ...decision.facts } })
            .orIgnore()
            .execute()
        const row = await this.entityManager.findOneByOrFail(AgentGraphDecisionEntity, { workItemId: decision.workItemId })
        return row.id
    }

    /** Closes the decision of an item with how the work ended; an item with no decision, or one already closed, is left alone. */
    async close(workItemId: string, closedAs: DecisionClosedAs): Promise<void> {
        await this.entityManager.update(AgentGraphDecisionEntity, { workItemId, closedAs: IsNull() }, { closedAs })
    }

    /** The closed decisions of an agent, oldest first, as the learning reads them. */
    async closedOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ClosedDecision>> {
        const rows = await this.entityManager.find(AgentGraphDecisionEntity, {
            where: { workspaceId, agentId },
            order: { createdAt: "DESC" },
            take: LEARN_WINDOW,
        })
        return rows
            .toReversed()
            .flatMap((row) =>
                row.closedAs === null
                    ? []
                    : [{ id: row.id, branchKey: row.branchKey, closedAs: row.closedAs, amount: amountOf(row.facts) }],
            )
    }
}

const amountOf = (facts: Readonly<Record<string, FactValue>>): number | null => {
    const entry = Object.entries(facts).find(([key, value]) => key !== MODEL_AMOUNT_FACT && key.endsWith(".amount_vnd") && typeof value === "number")
    return typeof entry?.[1] === "number" ? entry[1] : null
}
