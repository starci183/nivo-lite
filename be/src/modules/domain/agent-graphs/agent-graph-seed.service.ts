import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsService, type GraphState, type OptionalGraphState } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { graphDocumentSchema } from "./agent-graphs.schema"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { baseGraphOf } from "./policies/base-graph.policy"
import { sameBehaviour } from "./policies/graph-behaviour.policy"
import { flowProblemsOf } from "./policies/flow.policy"

@Injectable()
/**
 * Gives an agent its graph row: its module's base graph from the catalogue (start, tag, understand, done) with the data rights the module
 * grants, which the data-rights gate reads. It is code and not SQL because it needs the catalogue. No branch is derived from an authority
 * rule: the rules decide nothing since the engine gate was removed (2026-11-13). A seed follows its module's base graph until a person
 * publishes a version of their own.
 */
export class AgentGraphSeedService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly modules: ModulesService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly nodes?: GraphNodeRegistryService,
    ) {}

    /** The graph of the installation's agent, seeded on the first call; null when the installation has no agent yet. */
    async ensureFor(installationId: string, locale: Locale): Promise<OptionalGraphState> {
        const installation = await this.installations.findById(installationId)
        const agentId = installation?.agentId ?? null
        if (installation === null || agentId === null) return null
        const { workspaceId, moduleKey } = installation
        const existing = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (existing !== null) return existing
        return this.graphs.ensure(workspaceId, agentId, installationId, await this.derive(moduleKey, locale))
    }

    /**
     * Brings a seed up to its module's base graph: when the base graph now does something else, it is published as a new seed. A version a person published never moves this way, nor a graph with unpublished edits, nor one that holds a node graph (its
     * spec owns it; the refresh only checks it). Answers whether it moved.
     */
    async refresh(state: GraphState, moduleKey: string, locale: Locale): Promise<boolean> {
        const { workspaceId, agentId, active } = state
        if (active?.flow !== undefined) {
            this.checkFlow(workspaceId, agentId, active.flow)
            return false
        }
        if (state.activeKind !== "seed" || active === null || !sameBehaviour(state.draft, active)) return false
        const parsed = graphDocumentSchema.safeParse(await this.derive(moduleKey, locale))
        if (!parsed.success || sameBehaviour(parsed.data, active)) return false
        await this.graphs.publish({
            workspaceId,
            agentId,
            document: parsed.data,
            kind: "seed",
            note: "",
            memberId: null,
            contextVersionId: null,
        })
        return true
    }

    /**
     * A node graph is never re-derived from the base graph: its spec owns it. A refresh only checks the flow is still one the installed nodes
     * take. When it is not, each problem is logged; the version stays live and is never published without its flow.
     */
    private checkFlow(workspaceId: string, agentId: string, flow: GraphSpec): void {
        if (this.nodes === undefined) return
        // The accounts a node states are judged as at a publish (known kinds, ask-only operations); a flow that states none is judged as before.
        // A flow read from a @2 graph is judged by the @2 checks (`flowProblemsOf`), any other as before.
        const problems = flowProblemsOf(flow, this.nodes.installed())
        if (problems.length === 0) return
        for (const problem of problems) {
            this.logger.warn(AgentGraphsLogEvent.FlowUnsound, {
                workspaceId,
                agentId,
                code: problem.code,
                at: problem.at,
            })
        }
    }

    private async derive(moduleKey: string, locale: Locale): Promise<GraphDocument> {
        const module = await this.modules.find(moduleKey)
        return baseGraphOf(module, { locale, say: (key, params) => this.catalog.get(key, params ?? {}, locale) })
    }
}
