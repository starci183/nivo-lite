import { EntityEngineService } from "@modules/domain/entity-engine"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import { AgentGraphRecordsService } from "../../modules/domain/agent-graphs/agent-graph-records.service"
import { jsonOf } from "../../modules/domain/agent-graphs/agent-graphs.mapper"
import type { LiteWorld } from "./lite-world.service"

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
