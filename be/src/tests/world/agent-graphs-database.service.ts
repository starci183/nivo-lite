import type { EntityManager } from "typeorm"
import { EntityEngineService, entityEngineEntities } from "@modules/domain/entity-engine"
import type { GraphDocument, GraphMode } from "@modules/domain/agent-graphs"
import { AgentGraphRecordsService } from "../../modules/domain/agent-graphs/agent-graph-records.service"
import { jsonOf } from "../../modules/domain/agent-graphs/agent-graphs.mapper"
import type { GraphDecisionRecord } from "../../modules/domain/agent-graphs/agent-graphs-records.contracts"
import type { LiteWorld } from "./lite-world.service"

const [RecordEntity] = entityEngineEntities

/** What the graph decided about one work item: the branch it took, whether a person was asked, and whether it differed from the gate. */
export interface StoredDecision {
    readonly branchKey: string
    readonly outcome: string
    readonly shadowDiff: boolean
    readonly facts: Readonly<Record<string, string | number | boolean>>
}

/** The decision the graph of an agent recorded for a work item, read through the engine in the scope of the workspace; null when none. */
export const decisionRecordOf = (
    world: LiteWorld,
    workspaceId: string,
    workItemId: string,
): Promise<GraphDecisionRecord | null> =>
    world
        .resolve(EntityEngineService)
        .scoped(workspaceId, (scoped) => world.resolve(AgentGraphRecordsService).decisionOfItem(scoped, workItemId))

/** The decisions the graph of an agent recorded for a work item. */
export const decisionsOf = async (
    world: LiteWorld,
    workspaceId: string,
    agentId: string,
    workItemId: string,
): Promise<Array<StoredDecision>> => {
    const row = await decisionRecordOf(world, workspaceId, workItemId)
    return row?.agentId === agentId
        ? [{ branchKey: row.branchKey, outcome: row.outcome, shadowDiff: row.shadowDiff, facts: row.facts }]
        : []
}

/** What a later version of a graph is written with. */
export interface LaterVersionInput {
    readonly workspaceId: string
    readonly agentId: string
    readonly publishedBy: string
    readonly number: number
    readonly document: GraphDocument
}

/** Writes a later version of the graph through the engine and makes it the one that decides. */
export const publishLaterVersion = (world: LiteWorld, input: LaterVersionInput): Promise<void> =>
    world.resolve(EntityEngineService).scoped(input.workspaceId, async (scoped) => {
        const records = world.resolve(AgentGraphRecordsService)
        const version = await records.insertVersion(scoped, {
            agentId: input.agentId,
            number: input.number,
            document: jsonOf(input.document),
            documentHash: "proof-second-version",
            contextVersionId: null,
            changeKind: "edit",
            note: "New contract version",
            publishedBy: input.publishedBy,
        })
        const graph = await records.graphOf(scoped, input.agentId)
        if (version !== null && graph !== null) await records.patchGraph(scoped, graph, { activeVersionId: version.id })
    })

/** Starts the graph of an agent over: its recorded decisions removed and its mode set. */
export const restartGraph = async (
    world: LiteWorld,
    manager: EntityManager,
    workspaceId: string,
    agentId: string,
    mode: GraphMode,
): Promise<void> => {
    await manager.delete(RecordEntity, { workspaceId, entity: "agent.graph-decision" })
    const records = world.resolve(AgentGraphRecordsService)
    await world.resolve(EntityEngineService).scoped(workspaceId, async (scoped) => {
        const graph = await records.graphOf(scoped, agentId)
        if (graph !== null) await records.patchGraph(scoped, graph, { mode })
    })
}
