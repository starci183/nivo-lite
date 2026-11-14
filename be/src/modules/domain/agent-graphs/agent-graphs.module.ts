import { Module, type DynamicModule, type Provider, type Type } from "@nestjs/common"
import { SETUP_GRAPH } from "@modules/domain/modules"
import { NODE_REQUESTS_GATE } from "@modules/domain/tools"
import { PROVIDER_TRIGGER_RECEIVERS } from "@modules/domain/provider-triggers"
import { AgentWorkflowTriggerReceiversService } from "./agent-workflow-trigger-receivers.service"
import { AgentNodeRequestsService } from "./agent-node-requests.service"
import { AgentNodeRoutesService } from "./agent-node-routes.service"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphFlowService } from "./agent-graph-flow.service"
import { AGENT_GRAPHS_OPTIONS, GRAPH_FACT_READERS } from "./agent-graphs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-graphs.module-definition"
import { AgentGraphAdminService } from "./agent-graph-admin.service"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsNoticesService } from "./agent-rights-notices.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentRightsStandingService } from "./agent-rights-standing.service"
import { AgentStepTitlesService } from "./agent-step-titles.service"
import { AgentGraphSetupService } from "./agent-graph-setup.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphWatchService } from "./agent-graph-watch.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { WorkflowTriggerPicksService } from "./workflow-trigger-picks.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
import { AgentWorkflowInstallRunService } from "./agent-workflow-install-run.service"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"
import { AgentWorkflowStartService } from "./agent-workflow-start.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"
import { AgentGraphSubjectHoldsService } from "./agent-graph-subject-holds.service"
import { AgentGraphCallGuardService } from "./agent-graph-call-guard.service"
import { AgentGraphHoursGateService } from "./agent-graph-hours-gate.service"
import { AGENT_GRAPH_STORE } from "./agent-graph-store.port"
import { TypeormAgentGraphStore } from "./agent-graph-store.typeorm"
import { AGENT_WORKFLOW_STORE } from "./agent-workflow-store.port"
import { TypeormAgentWorkflowStore } from "./agent-workflow-store.typeorm"
import { AgentGraphStepMemoryService } from "./agent-graph-step-memory.service"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphAiCoreService } from "./agent-graph-ai-core.service"
import { AgentGraphTurnPolicyService } from "./agent-graph-turn-policy.service"
import { AgentGraphRunQueueService } from "./agent-graph-run-queue.service"
import { AgentGraphWakeNoticesService } from "./agent-graph-wake-notices.service"
import { GraphFactsService } from "./graph-facts.service"
import { GraphFactReadersService } from "./graph-fact-readers.service"
import type { GraphFactReader } from "./agent-graphs.port"
import { OutgoingFactReaderService } from "./outgoing-fact-reader.service"

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

/** What a pinned version's node asks for on accounts, which the gateway's node-level judge reads (it decides only where a workspace's switch is on). */
const REQUESTS_PORT: PortBinding = { provide: NODE_REQUESTS_GATE, useExisting: AgentNodeRequestsService }

/** The core tables of the graphs, which every part reads and writes through its records service. */
const GRAPH_STORE_PORT: PortBinding = { provide: AGENT_GRAPH_STORE, useExisting: TypeormAgentGraphStore }

/** The core tables of the workflows, read and written through their records service. */
const WORKFLOW_STORE_PORT: PortBinding = { provide: AGENT_WORKFLOW_STORE, useExisting: TypeormAgentWorkflowStore }

/** The reader of what the agent proposes, which every app that walks a graph carries. */
const OUTGOING_FACTS: Type = OutgoingFactReaderService

/** The store and the node requests alone: what the gateway reads. */
const RIGHTS_ONLY: Part = {
    services: [
        AgentGraphsService,
        AgentGraphRecordsService,
        TypeormAgentGraphStore,
        AgentWorkflowRecordsService,
        TypeormAgentWorkflowStore,
        AgentNodeRequestsService,
        GraphFactsService,
        OUTGOING_FACTS,
    ],
    ports: [REQUESTS_PORT, GRAPH_STORE_PORT, WORKFLOW_STORE_PORT],
}

/** The store alone, with the publishing of a flow: what an app that only seeds graphs carries. */
const STORE_ONLY: Part = {
    services: [
        AgentGraphsService,
        AgentGraphRecordsService,
        TypeormAgentGraphStore,
        AgentWorkflowRecordsService,
        TypeormAgentWorkflowStore,
        AgentGraphFlowService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
        AgentWorkflowStoreService,
        AgentWorkflowAdoptionService,
        AgentWorkflowsService,
        AgentWorkflowInstallService,
        AgentWorkflowInstallRunService,
    ],
    ports: [GRAPH_STORE_PORT, WORKFLOW_STORE_PORT],
}

/**
 * The people's doors to the workflows alone (the mcp app): the stores of the graphs and the workflows, the workflows' reads (list, whether
 * one can start and its input contract, the runs' versions) and the start that writes the wake the api's engine drains. None of the
 * engine that walks a graph (no flow runs, no graph context, no node registry, no gateway).
 */
const DOORS_ONLY: Part = {
    services: [
        AgentGraphsService,
        AgentGraphRecordsService,
        TypeormAgentGraphStore,
        AgentWorkflowRecordsService,
        TypeormAgentWorkflowStore,
        AgentWorkflowStoreService,
        AgentWorkflowAdoptionService,
        AgentWorkflowsService,
        AgentWorkflowRunsService,
        AgentGraphLayoutService,
        AgentWorkflowsAdminService,
        AgentWorkflowStartService,
    ],
    ports: [GRAPH_STORE_PORT, WORKFLOW_STORE_PORT],
}

/** Registers configured readers after their graph-gated connectors can construct; nothing serves until the module compiles. */
const FACT_READERS_READY: unique symbol = Symbol("domain.agent-graphs.fact-readers-ready")

/** The whole capability. */
const WHOLE: Part = {
    services: [
        AgentGraphsService,
        AgentGraphRecordsService,
        TypeormAgentGraphStore,
        AgentWorkflowRecordsService,
        TypeormAgentWorkflowStore,
        AgentNodeRequestsService,
        // The routes a step cannot follow here (`ctx.run.unreachable`), which the node host reads (apps/api binds it on graph-nodes).
        AgentNodeRoutesService,
        GraphFactsService,
        OUTGOING_FACTS,
        AgentGraphContextService,
        AgentGraphSeedService,
        AgentGraphFlowService,
        AgentGraphPublishService,
        AgentGraphProposalsService,
        AgentGraphViewService,
        AgentGraphAdminService,
        AgentGraphWatchService,
        AgentGraphSetupService,
        AgentGraphContractSetupService,
        AgentGraphSubjectHoldsService,
        AgentGraphCallGuardService,
        AgentGraphHoursGateService,
        AgentGraphWakeNoticesService,
        AgentGraphRawRowsService,
        AgentGraphFlowRunsService,
        AgentGraphRunNoticesService,
        AgentGraphAiCoreService,
        AgentGraphTurnPolicyService,
        AgentGraphRunQueueService,
        AgentGraphStepMemoryService,
        AgentStepTitlesService,
        AgentGraphRightsService,
        AgentRightsNoticesService,
        AgentRightsRecordsService,
        AgentRightsStandingService,
        AgentWorkflowStoreService,
        AgentWorkflowAdoptionService,
        AgentWorkflowsService,
        AgentWorkflowInstallService,
        AgentWorkflowRunsService,
        WorkflowTriggerPicksService,
        AgentWorkflowTriggerReceiversService,
        AgentGraphLayoutService,
        AgentWorkflowsAdminService,
        AgentWorkflowStartService,
    ],
    ports: [
        REQUESTS_PORT,
        { provide: SETUP_GRAPH, useExisting: AgentGraphSetupService },
        { provide: PROVIDER_TRIGGER_RECEIVERS, useExisting: AgentWorkflowTriggerReceiversService },
        GRAPH_STORE_PORT,
        WORKFLOW_STORE_PORT,
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
        inject: [GraphFactReadersService, ...(options.readers ?? []), OUTGOING_FACTS],
    },
]

/** The part of the capability an app asked for. */
const partOf = (options: typeof OPTIONS_TYPE): Part => {
    if (options.doorsOnly === true) return DOORS_ONLY
    if (options.storeOnly === true) return STORE_ONLY
    return options.rightsOnly === true ? RIGHTS_ONLY : WHOLE
}

@Module({})
/**
 * Each agent as a flow the owner can read and change: the store of its draft and immutable versions, the brief a turn is given, and the
 * store and node requests the gateway reads. It binds the ports the capabilities below it leave open, so with no
 * graph they behave exactly as before. An app that serves only the gateway asks for `rightsOnly`.
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
                ...(options.storeOnly === true || options.doorsOnly === true ? [] : factReaders(options)),
                ...part.ports,
            ],
            exports: [...part.services, ...part.ports.map((port) => port.provide)],
        }
    }
}
