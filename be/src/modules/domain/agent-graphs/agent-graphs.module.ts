import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_GRAPH_BRIEF } from "@modules/domain/agent-turns"
import { SETUP_GRAPH } from "@modules/domain/modules"
import { WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import { DATA_RIGHTS_GATE } from "@modules/domain/mcp-gateway"
import { AgentDataRightsService } from "./agent-data-rights.service"
import { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { AgentGraphBriefService } from "./agent-graph-brief.service"
import { AgentGraphDeciderService } from "./agent-graph-decider.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AGENT_GRAPHS_OPTIONS, GRAPH_FACT_READERS } from "./agent-graphs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-graphs.module-definition"
import { AgentGraphAdminService } from "./agent-graph-admin.service"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphRunService } from "./agent-graph-run.service"
import { AgentGraphSetupService } from "./agent-graph-setup.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphWatchService } from "./agent-graph-watch.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { GraphFactsService } from "./graph-facts.service"

@Module({})
/**
 * Each agent as a flow the owner can read and change: the store of its draft and immutable versions, the branch that runs in the
 * work engine, the brief a turn is given, and the data rights the gateway enforces. It binds the three ports the capabilities below it
 * leave open (the branch decider, the turn brief, the data rights), so with no graph they behave exactly as before.
 */
export class AgentGraphsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            AgentGraphsService,
            AgentGraphDecisionsService,
            AgentGraphDeciderService,
            AgentGraphBriefService,
            AgentDataRightsService,
            GraphFactsService,
            AgentGraphContextService,
            AgentGraphSeedService,
            AgentGraphPublishService,
            AgentGraphProposalsService,
            AgentGraphViewService,
            AgentGraphAdminService,
            AgentGraphApprovalsService,
            AgentGraphRunService,
            AgentGraphWatchService,
            AgentGraphSetupService,
        ]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...services,
                { provide: AGENT_GRAPHS_OPTIONS, useValue: options },
                {
                    provide: GRAPH_FACT_READERS,
                    useFactory: (...readers: ReadonlyArray<object>) => readers,
                    inject: [...(options.readers ?? [])],
                },
                { provide: WORK_BRANCH_DECIDER, useExisting: AgentGraphDeciderService },
                { provide: AGENT_GRAPH_BRIEF, useExisting: AgentGraphBriefService },
                { provide: DATA_RIGHTS_GATE, useExisting: AgentDataRightsService },
                { provide: SETUP_GRAPH, useExisting: AgentGraphSetupService },
            ],
            exports: [...services, WORK_BRANCH_DECIDER, AGENT_GRAPH_BRIEF, DATA_RIGHTS_GATE, SETUP_GRAPH],
        }
    }
}
