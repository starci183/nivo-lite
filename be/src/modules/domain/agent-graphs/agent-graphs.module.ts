import { Module } from "@nestjs/common"
import type { DynamicModule, Type } from "@nestjs/common"
import { AGENT_GRAPH_BRIEF } from "@modules/domain/agent-turns"
import { SETUP_GRAPH } from "@modules/domain/modules"
import { WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import { DATA_RIGHTS_GATE } from "@modules/domain/mcp-gateway"
import { AgentDataRightsService } from "./agent-data-rights.service"
import { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { AgentGraphBriefService } from "./agent-graph-brief.service"
import { AgentGraphDeciderService } from "./agent-graph-decider.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AGENT_GRAPH_APPROVALS, AGENT_GRAPHS_OPTIONS, GRAPH_FACT_READERS } from "./agent-graphs.decorators"
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

/** A port the capability binds to one of its services. */
interface PortBinding {
    readonly provide: symbol
    readonly useExisting: Type
}

/** The services of one part of the capability and the ports it binds. */
interface Part {
    readonly services: ReadonlyArray<Type>
    readonly ports: ReadonlyArray<PortBinding>
}

const RIGHTS_PORT: PortBinding = { provide: DATA_RIGHTS_GATE, useExisting: AgentDataRightsService }

/** The data rights alone: the store and the gate the gateway enforces. */
const RIGHTS_ONLY: Part = { services: [AgentGraphsService, AgentDataRightsService], ports: [RIGHTS_PORT] }

/** The branch decider alone: the store, the ledger, the fact readers and the port the work engine calls. */
const DECIDER_ONLY: Part = {
    services: [AgentGraphsService, AgentGraphDecisionsService, GraphFactsService, AgentGraphDeciderService],
    ports: [{ provide: WORK_BRANCH_DECIDER, useExisting: AgentGraphDeciderService }],
}

/** The whole capability. */
const WHOLE: Part = {
    services: [
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
    ],
    ports: [
        { provide: WORK_BRANCH_DECIDER, useExisting: AgentGraphDeciderService },
        { provide: AGENT_GRAPH_APPROVALS, useExisting: AgentGraphApprovalsService },
        { provide: AGENT_GRAPH_BRIEF, useExisting: AgentGraphBriefService },
        RIGHTS_PORT,
        { provide: SETUP_GRAPH, useExisting: AgentGraphSetupService },
    ],
}

/** The part of the capability an app asked for. */
const partOf = (options: typeof OPTIONS_TYPE): Part => {
    if (options.rightsOnly === true) return RIGHTS_ONLY
    return options.deciderOnly === true ? DECIDER_ONLY : WHOLE
}

@Module({})
/**
 * Each agent as a flow the owner can read and change: the store of its draft and immutable versions, the branch that runs in the
 * work engine, the brief a turn is given, and the data rights the gateway enforces. It binds the three ports the capabilities below it
 * leave open (the branch decider, the turn brief, the data rights), so with no graph they behave exactly as before. An app that serves
 * only the gateway asks for `rightsOnly`, and one that judges branches with no approval road for `deciderOnly`.
 */
export class AgentGraphsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const part = partOf(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...part.services,
                { provide: AGENT_GRAPHS_OPTIONS, useValue: options },
                {
                    provide: GRAPH_FACT_READERS,
                    useFactory: (...readers: ReadonlyArray<object>) => readers,
                    inject: [...(options.readers ?? [])],
                },
                ...part.ports,
            ],
            exports: [...part.services, ...part.ports.map((port) => port.provide)],
        }
    }
}
