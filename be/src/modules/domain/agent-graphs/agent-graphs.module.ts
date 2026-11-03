import { Module } from "@nestjs/common"
import type { DynamicModule, Provider, Type } from "@nestjs/common"
import { SETUP_GRAPH } from "@modules/domain/modules"
import { OUTPUT_NODE_READER, WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import { DATA_RIGHTS_GATE, TOOL_GRAPH_GATE } from "@modules/domain/mcp-gateway"
import { AgentDataRightsService } from "./agent-data-rights.service"
import { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { AGENT_RUN_WAIT_TIMEOUT } from "@modules/domain/agent-runs"
import { AgentGraphWaitTimeoutService } from "./agent-graph-wait-timeout.service"
import { AgentGraphAsksService } from "./agent-graph-asks.service"
import { AgentGraphBriefService } from "./agent-graph-brief.service"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphContractsService } from "./agent-graph-contracts.service"
import { AgentGraphChecksService } from "./agent-graph-checks.service"
import { AgentGraphDeciderService } from "./agent-graph-decider.service"
import { AgentGraphFlowService } from "./agent-graph-flow.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import {
    AGENT_GRAPH_APPROVALS,
    AGENT_GRAPH_BRIEF,
    AGENT_GRAPHS_OPTIONS,
    GRAPH_FACT_READERS,
    GRAPH_WORK_DECISIONS,
} from "./agent-graphs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-graphs.module-definition"
import { AgentGraphAdminService } from "./agent-graph-admin.service"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphOutputNodesService } from "./agent-graph-output-nodes.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphRunService } from "./agent-graph-run.service"
import { AgentGraphSetupService } from "./agent-graph-setup.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphToolGateService } from "./agent-graph-tool-gate.service"
import { AgentGraphWatchService } from "./agent-graph-watch.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { GraphFactsService } from "./graph-facts.service"
import { GraphFactReadersService } from "./graph-fact-readers.service"
import type { GraphFactReader } from "./agent-graphs.port"
import { OutgoingFactReaderService } from "./outgoing-fact-reader.service"
import { WorkAmountFactReaderService } from "./work-amount-fact-reader.service"

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

/** The graph's gate on a write tool, which the gateway consults on every door. */
const TOOL_PORT: PortBinding = { provide: TOOL_GRAPH_GATE, useExisting: AgentGraphToolGateService }

/** The nodes an output runs on, which the steps of a run name. */
const OUTPUT_NODES_PORT: PortBinding = { provide: OUTPUT_NODE_READER, useExisting: AgentGraphOutputNodesService }

/** The reader of what the agent proposes, which every app that walks a graph carries. */
const OUTGOING_FACTS: Type = OutgoingFactReaderService

/** The data rights alone, with the gate on write tools: what the gateway enforces. */
const RIGHTS_ONLY: Part = {
    services: [
        AgentGraphsService,
        AgentDataRightsService,
        AgentGraphDecisionsService,
        GraphFactsService,
        OUTGOING_FACTS,
        AgentGraphChecksService,
        AgentGraphToolGateService,
        AgentGraphOutputNodesService,
    ],
    ports: [RIGHTS_PORT, TOOL_PORT, OUTPUT_NODES_PORT],
}

/** The store alone, with the publishing of a flow: what an app that only seeds graphs carries. */
const STORE_ONLY: Part = { services: [AgentGraphsService, AgentGraphFlowService], ports: [] }

/** The reader of the amount of the work item itself, which every app that decides branches carries beside the readers of its modules. */
const WORK_AMOUNT: Type = WorkAmountFactReaderService

/** Registers configured readers after their graph-gated connectors can construct; nothing serves until the module compiles. */
const FACT_READERS_READY: unique symbol = Symbol("domain.agent-graphs.fact-readers-ready")

/** The branch decider alone: the store, the ledger, the fact readers and the port the work engine calls. */
const DECIDER_ONLY: Part = {
    services: [
        AgentGraphsService,
        AgentGraphDecisionsService,
        GraphFactsService,
        AgentGraphChecksService,
        AgentGraphToolGateService,
        AgentGraphDeciderService,
        WORK_AMOUNT,
        OUTGOING_FACTS,
    ],
    ports: [{ provide: WORK_BRANCH_DECIDER, useExisting: AgentGraphDeciderService }, TOOL_PORT],
}

/** The whole capability. */
const WHOLE: Part = {
    services: [
        AgentGraphsService,
        AgentGraphDecisionsService,
        AgentGraphChecksService,
        AgentGraphToolGateService,
        AgentGraphDeciderService,
        AgentGraphBriefService,
        AgentGraphContractsService,
        AgentDataRightsService,
        GraphFactsService,
        WORK_AMOUNT,
        OUTGOING_FACTS,
        AgentGraphContextService,
        AgentGraphSeedService,
        AgentGraphFlowService,
        AgentGraphPublishService,
        AgentGraphProposalsService,
        AgentGraphViewService,
        AgentGraphAdminService,
        AgentGraphApprovalsService,
        AgentGraphAsksService,
        AgentGraphOutputNodesService,
        AgentGraphRunService,
        AgentGraphWatchService,
        AgentGraphSetupService,
        AgentGraphContractSetupService,
        AgentGraphWaitTimeoutService,
        AgentGraphFlowRunsService,
        AgentGraphNodeStepService,
    ],
    ports: [
        { provide: WORK_BRANCH_DECIDER, useExisting: AgentGraphDeciderService },
        { provide: AGENT_GRAPH_APPROVALS, useExisting: AgentGraphApprovalsService },
        { provide: AGENT_GRAPH_BRIEF, useExisting: AgentGraphBriefService },
        RIGHTS_PORT,
        TOOL_PORT,
        OUTPUT_NODES_PORT,
        { provide: SETUP_GRAPH, useExisting: AgentGraphSetupService },
        { provide: AGENT_RUN_WAIT_TIMEOUT, useExisting: AgentGraphWaitTimeoutService },
    ],
}

/** The registry of the fact readers and the registration of the configured ones, for an app that decides branches. */
const factReaders = (options: typeof OPTIONS_TYPE): Array<Provider> => [
    GraphFactReadersService,
    {
        provide: GRAPH_FACT_READERS,
        useFactory: (registry: GraphFactReadersService) => registry.all(),
        inject: [GraphFactReadersService],
    },
    {
        provide: FACT_READERS_READY,
        useFactory: (registry: GraphFactReadersService, ...readers: ReadonlyArray<GraphFactReader>) =>
            registry.register(readers),
        inject: [
            GraphFactReadersService,
            ...(options.readers ?? []),
            OUTGOING_FACTS,
            ...(options.rightsOnly === true ? [] : [WORK_AMOUNT]),
        ],
    },
]

/** The part of the capability an app asked for. */
const partOf = (options: typeof OPTIONS_TYPE): Part => {
    if (options.storeOnly === true) return STORE_ONLY
    if (options.rightsOnly === true) return RIGHTS_ONLY
    return options.deciderOnly === true ? DECIDER_ONLY : WHOLE
}

@Module({})
/**
 * Each agent as a flow the owner can read and change: the store of its draft and immutable versions, the branch that runs in the
 * work engine, the brief a turn is given, and the data rights and the gate on write tools the gateway enforces. It binds the ports the
 * capabilities below it leave open, so with no graph they behave exactly as before. An app that serves only the gateway asks for
 * `rightsOnly`, and one that judges branches with no approval road for `deciderOnly`.
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
                ...(options.workDecisions === undefined
                    ? []
                    : [{ provide: GRAPH_WORK_DECISIONS, useExisting: options.workDecisions }]),
                ...(options.storeOnly === true ? [] : factReaders(options)),
                ...part.ports,
            ],
            exports: [...part.services, ...part.ports.map((port) => port.provide)],
        }
    }
}
