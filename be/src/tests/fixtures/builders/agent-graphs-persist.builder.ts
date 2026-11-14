import type { EntityManager } from "typeorm"
import type { GraphDocument, GraphMode } from "@modules/domain/agent-graphs"
import {
    AgentGraphEntity,
    AgentGraphVersionEntity,
} from "../../../modules/domain/agent-graphs/persistence/entities"

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

/** Writes the graph of an agent (its row id is the agent) and its first version as the superuser of the world, the version already the one that decides. */
export const insertGraphRecords = async (manager: EntityManager, input: GraphRecordsInput): Promise<void> => {
    await manager.save(AgentGraphVersionEntity, {
        id: input.versionId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        number: 1,
        document: input.document,
        documentHash: "proof",
        contextVersionId: null,
        changeKind: "edit",
        note: "",
        publishedBy: input.publishedBy,
        publishedAt: new Date("2026-11-01T01:00:00.000Z"),
    })
    await manager.save(AgentGraphEntity, {
        id: input.agentId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        installationId: input.installationId,
        draft: input.document,
        draftRev: 1,
        activeVersionId: input.versionId,
        mode: input.mode,
    })
}
