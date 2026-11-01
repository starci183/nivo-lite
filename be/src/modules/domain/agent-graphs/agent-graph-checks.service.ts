import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { GraphAnswer, GraphCheck } from "@modules/domain/authority-rules"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import type {
    DecisionClosedAs,
    DecisionOutcome,
    FactRegistry,
    FactValues,
    GraphDocument,
} from "./agent-graphs.contracts"
import type { GraphWalk } from "./agent-graphs-walk.contracts"
import type { FactSubject } from "./agent-graphs.port"
import { GraphFactsService } from "./graph-facts.service"
import { moneyAccepted } from "./policies/money-facts.policy"
import { factsOfWalk, walkGraph } from "./policies/graph-walk.policy"
import type { WalkOptions } from "./policies/graph-walk.policy"

/** A walk with the facts it read and the registry that names them. */
export interface WalkRead {
    /** The walk. */
    readonly walk: GraphWalk
    /** The facts as read. */
    readonly read: FactValues
    /** The facts the readers declare. */
    readonly registry: FactRegistry
}

const RUN: GraphAnswer = { outcome: "run", unread: [], unjudged: null, divert: null }

/** The answer of a graph that holds the action and cannot be read or walked: a person decides. */
const safeAnswer = (unjudged: string): GraphAnswer => ({ outcome: "ask", unread: [], unjudged, divert: null })

/** What a recorded run came to. */
export const outcomeOf = (walk: GraphWalk): DecisionOutcome => {
    if (walk.outcome === "ask" || walk.outcome === "stop" || walk.outcome === "divert") return walk.outcome
    return "auto"
}

/** How a walk that ended the work closed it; null while the work stays open. */
export const closedAsOf = (walk: GraphWalk): DecisionClosedAs | null =>
    walk.outcome === "stop" || walk.outcome === "divert" ? "stopped" : null

/** The facts as stored: only the ones that were read. */
export const factsRead = (facts: FactValues): Readonly<Record<string, string | number | boolean>> =>
    Object.fromEntries(Object.entries(facts).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])))

const answerOf = (walk: GraphWalk): GraphAnswer => ({
    outcome: walk.outcome === "unheld" ? "run" : walk.outcome,
    unread: walk.unread,
    unjudged: walk.unjudged === "not_in_graph" ? null : walk.unjudged,
    divert: walk.divert,
})

@Injectable()
/**
 * The walk of a graph on what an agent proposes, and the check of what leaves with no work item (a reply, a write tool, a hand-over).
 * It reads the facts from the backend alone and writes one run for each proposal. A graph the owner set to shadow records and answers
 * `run`. A graph that holds the action and cannot be read or walked answers an ask: nothing falls through to run alone.
 */
export class AgentGraphChecksService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly graphs: AgentGraphsService,
        private readonly facts: GraphFactsService,
        private readonly decisions: AgentGraphDecisionsService,
    ) {}

    /** Reads the facts a walk of the action needs and walks the graph on them. */
    async walk(
        workspaceId: string,
        document: GraphDocument,
        action: string,
        subject: FactSubject,
        options: WalkOptions = {},
    ): Promise<WalkRead> {
        const registry = this.facts.registry()
        const accepted = { ...subject, money: moneyAccepted(document, subject.money) }
        const read = await this.facts.read(workspaceId, accepted, factsOfWalk(document, action, options))
        return { walk: walkGraph(document, action, read, registry, options), read, registry }
    }

    /** What the graph of the agent says about something that leaves with no work item. */
    async check(request: GraphCheck): Promise<GraphAnswer> {
        if (request.installationId === null) return RUN
        try {
            const state = await this.graphs.stateOfInstallation(request.installationId)
            return state === null ? RUN : await this.checked(request, state)
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.DecideFailed, cause, { key: request.key })
            return safeAnswer("failed")
        }
    }

    private async checked(request: GraphCheck, state: GraphState): Promise<GraphAnswer> {
        const versionId = state.activeVersionId
        if (versionId === null) return RUN
        const enforced = state.mode === "enforced"
        if (state.active === null) return enforced ? safeAnswer("unreadable") : RUN
        const { walk, read } = await this.walk(
            request.workspaceId,
            state.active,
            request.action,
            {
                type: request.subjectType,
                id: request.subjectId ?? "",
                workItemId: "",
                text: request.text,
                leadId: request.leadId,
                attributes: request.attributes,
                money: request.money ?? undefined,
            },
            { decideOnly: request.road === "tool" },
        )
        const opensWork = enforced && walk.outcome === "ask" && request.askOpensWork
        if (!opensWork) await this.record(request, state, versionId, walk, read)
        return enforced ? answerOf(walk) : RUN
    }

    private record(
        request: GraphCheck,
        state: GraphState,
        versionId: string,
        walk: GraphWalk,
        read: FactValues,
    ): Promise<string> {
        return this.decisions.record({
            workspaceId: request.workspaceId,
            agentId: state.agentId,
            workItemId: null,
            dedupeKey: `${request.road}:${createHash("sha256").update(request.key).digest("hex")}`,
            road: request.road,
            mode: state.mode,
            gateVerdict: null,
            versionId,
            turnId: request.turnId,
            wakeId: request.wakeId,
            action: request.action,
            path: walk.path,
            facts: factsRead(read),
            branchKey: walk.branchKey,
            outcome: outcomeOf(walk),
            shadowDiff: walk.outcome === "ask" || walk.outcome === "stop" || walk.outcome === "divert",
            unread: walk.unread,
            unjudged: walk.unjudged,
            subjectType: request.subjectType,
            subjectId: request.subjectId,
            closedAs: closedAsOf(walk),
        })
    }
}
