import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { NodeRouteReach, NodeStepRef, NodeTurn } from "@modules/domain/graph-nodes"
import { WorkflowCallReachService, type CalledWorkflowRef } from "@modules/domain/agents"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsError } from "./errors/agent-graphs.error"
import { routeRoadsOf, type RoadEnd } from "./policies/route-roads.policy"

/** The step graph a run is pinned to, or none when its version cannot be read. */
type PinnedNodes = ReadonlyArray<GraphSpecNode>

@Injectable()
/**
 * THE ROUTES A STEP CANNOT FOLLOW HERE (`ctx.run.unreachable`). Rule (R75, engine words): a step's route is closed when EVERY road it
 * leads to (`routeRoadsOf`: through the engine's conditions and hand-backs) ends at a workflow call this workspace cannot start; a road
 * that may reach a node, an outcome, the end of the run or a call that can start keeps the route open. "Can start" is the call effect's
 * own answer (`WorkflowCallReachService.startable`: an agent of the module and a live registration of the workflow), never a second
 * list. Read from the version the run is pinned to, as the node's request is. Any node, any target; nothing here names a route.
 */
export class AgentNodeRoutesService implements NodeRouteReach {
    constructor(
        private readonly graphs: AgentGraphsService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly reach?: WorkflowCallReachService,
    ) {}

    /** The names of the step's routes whose every road ends at a call this workspace cannot start, in the step's order. */
    async closedRoutesOf(turn: NodeTurn, step: NodeStepRef): Promise<ReadonlyArray<string>> {
        const { reach } = this
        if (reach === undefined) return []
        const roads = routeRoadsOf(await this.nodesOf(turn, step), step.nodeKey)
        if (roads.length === 0) return []
        // Each target is asked once per step, however many roads name it.
        const asked = new Map<string, Promise<boolean>>()
        const startable = (call: CalledWorkflowRef): Promise<boolean> => {
            const key = `${call.module}\u0000${call.workflow}`
            const known = asked.get(key)
            if (known !== undefined) return known
            const answer = reach.startable(
                { workspaceId: turn.workspaceId, routeId: turn.conversationId, contactId: turn.contactId ?? null },
                call,
            )
            asked.set(key, answer)
            return answer
        }
        const closedEnd = async (end: RoadEnd): Promise<boolean> =>
            end.kind === "call" && !(await startable({ module: end.module, workflow: end.workflow }))
        const closed: Array<string> = []
        for (const road of roads) {
            if (road.ends.length === 0) continue
            const ends = await Promise.all(road.ends.map((end) => closedEnd(end)))
            if (ends.every(Boolean)) closed.push(road.route)
        }
        return closed
    }

    /** The steps of the version the run is pinned to; none when the version is not the agent's or cannot be read (every route open). */
    private async nodesOf(turn: NodeTurn, step: NodeStepRef): Promise<PinnedNodes> {
        try {
            const { document } = await this.graphs.versionAt(turn.workspaceId, turn.agentId, step.versionId)
            return document.flow?.nodes ?? []
        } catch (cause) {
            if (!(cause instanceof AgentGraphsError)) throw cause
            this.logger.warn(AgentGraphsLogEvent.NodeRequestUnreadable, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                versionId: step.versionId,
                nodeKey: step.nodeKey,
                code: cause.code,
            })
            return []
        }
    }
}
