import type { EntityManager } from "typeorm"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import type { GraphDocument, GraphMode } from "@modules/domain/agent-graphs"

const [RecordEntity] = entityEngineEntities

/** What a graph and its first version are written with. */
export interface GraphRecordsInput {
    readonly workspaceId: string
    readonly agentId: string
    readonly installationId: string
    /** The id of the version, a uuid the world supplies. */
    readonly versionId: string
    /** The membership id that published the version. */
    readonly publishedBy: string
    readonly document: GraphDocument
    readonly mode: GraphMode
}

/** Writes the graph of an agent (its record id is the agent's) and its first version as the world's superuser, the version already the one that decides. */
export const insertGraphRecords = async (manager: EntityManager, input: GraphRecordsInput): Promise<void> => {
    await manager.save(RecordEntity, {
        entity: "agent.graph-version",
        id: input.versionId,
        workspaceId: input.workspaceId,
        data: {
            agentId: input.agentId,
            number: 1,
            document: input.document,
            documentHash: "proof",
            contextVersionId: null,
            changeKind: "edit",
            note: "",
            publishedBy: input.publishedBy,
            publishedAt: "2026-11-01T01:00:00.000Z",
        },
    })
    await manager.save(RecordEntity, {
        entity: "agent.graph",
        id: input.agentId,
        workspaceId: input.workspaceId,
        data: {
            agentId: input.agentId,
            installationId: input.installationId,
            draft: input.document,
            draftRev: 1,
            activeVersionId: input.versionId,
            mode: input.mode,
        },
    })
}

/** What a decision the world seeds is written with. */
export interface DecisionRecordInput {
    readonly workspaceId: string
    readonly agentId: string
    readonly workItemId: string
    readonly versionId: string
    readonly action: string
    readonly branchKey: string
    readonly path: ReadonlyArray<string>
    readonly outcome: string
    readonly approvalRequestId: string | null
}

/** Writes an open decision of the graph of an agent for a work item (its record id is the item's), as the world's superuser. */
export const insertDecisionRecord = async (manager: EntityManager, input: DecisionRecordInput): Promise<void> => {
    await manager.save(RecordEntity, {
        entity: "agent.graph-decision",
        id: input.workItemId,
        workspaceId: input.workspaceId,
        data: {
            agentId: input.agentId,
            workItemId: input.workItemId,
            road: "work",
            mode: "enforced",
            unread: { keys: [] },
            versionId: input.versionId,
            action: input.action,
            path: { keys: [...input.path] },
            facts: {},
            branchKey: input.branchKey,
            outcome: input.outcome,
            approvalRequestId: input.approvalRequestId,
            shadowDiff: false,
        },
    })
}
