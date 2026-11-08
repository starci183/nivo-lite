import { Injectable } from "@nestjs/common"
import { InjectInstallations, type InstallationDirectory } from "@modules/domain/agents"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { IntentRegistryService, dataTagOf, type FrameAction } from "@modules/domain/intent-contracts"
import { wakeSources } from "@modules/domain/agent-work"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService, type SetupApplier } from "@modules/domain/modules"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { setupContractsSchema } from "./agent-graph-contract-setup.schema"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService, type GraphState } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { applyContract } from "./policies/contract-patch.policy"
import { contractsFromSetup, factLineOf, type ContractSetupFact } from "./policies/contract-setup.policy"
import { eventTypesOf, reachableIntents, type ReachedIntent } from "./policies/intent-of-step.policy"
import { unheldRulesOf } from "./policies/unheld-rules.policy"

/** The language the proposals are written in, as the graph is seeded. */
const LOCALE = "vi"
/** The most facts one setup reads, and how long the model may take. */
const FACTS_READ_MAX = 500
const TIMEOUT_MS = 90_000

@Injectable()
/**
 * NIVO's proposals at setup. Once the owner applied the setup, the model reads the Second Brain and proposes, for each intent the published
 * graph offers, the task and the business limits of this shop; every limit cites the facts that state it, and each contract is raised as a
 * proposal the owner approves into a new version. A rule that only the prose of the setup states (a sum asked about, no condition holding
 * it) is raised as a gap the owner sees. This runs only at setup, never in a turn, and a failure here never fails the setup.
 */
export class AgentGraphContractSetupService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectInstallations() private readonly directory: InstallationDirectory,
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly modules: ModulesService,
        private readonly facts: BrainFactsService,
        private readonly generations: DirectGenerationService,
        private readonly proposals: AgentGraphProposalsService,
        private readonly intents: IntentRegistryService,
    ) {}

    /** Proposes the contracts and the gaps of an installation whose setup was just applied; answers how many proposals were new. */
    async proposeFor(applier: SetupApplier): Promise<number> {
        try {
            const state = await this.graphs.stateOfInstallation(applier.workspaceId, applier.installationId)
            if (state?.workspaceId !== applier.workspaceId || state.active === null) return 0
            const [contracts, gaps] = await Promise.all([
                this.raiseContracts(state, state.active),
                this.raiseGaps(state, applier),
            ])
            return contracts + gaps
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.ContractSetupFailed, cause, {
                workspaceId: applier.workspaceId,
                installationId: applier.installationId,
            })
            return 0
        }
    }

    private async raiseContracts(state: GraphState, active: NonNullable<GraphState["active"]>): Promise<number> {
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) return 0
        const catalog = await this.modules.findByKey(installation.moduleKey)
        const actions = catalog.authorityActions.map((entry) => ({
            action: entry.action,
            amountLimit: entry.amountLimit,
        }))
        const offered = this.offeredOf(active, actions)
        const intents = [...new Set(offered.map((entry) => entry.intent))]
        const scope = installation.isMulti ? installation.id : null
        const records = await this.facts.forView(
            state.workspaceId,
            "internal",
            installation.moduleKey,
            scope,
            FACTS_READ_MAX,
        )
        if (intents.length === 0 || records.length === 0) return 0
        const known: ReadonlyArray<ContractSetupFact> = records.map((fact) => ({
            id: fact.id,
            subject: fact.subjectLabel,
            attribute: fact.attributeLabel,
            value: fact.value,
        }))
        const answer = await this.generations.run({
            workspaceId: state.workspaceId,
            purpose: "setup_chat",
            responseFormat: "json",
            timeoutMs: TIMEOUT_MS,
            kind: "setup",
            module: "setup",
            locale: LOCALE,
            messages: [
                { role: "system", content: this.catalog.get("intentContracts.setup.system", {}, LOCALE) },
                {
                    role: "user",
                    content: [
                        this.catalog.get("intentContracts.setup.intents", {}, LOCALE),
                        ...offered.map((entry) => `- ${entry.intent}: ${entry.label}`),
                        this.catalog.get("intentContracts.setup.facts", {}, LOCALE),
                        dataTagOf("brain_facts", known.map((item) => factLineOf(item)).join("\n")),
                    ].join("\n"),
                },
            ],
        })
        if (!answer.ok) return 0
        const read = parseJsonText(answer.output)
        const parsed = read.ok ? setupContractsSchema.safeParse(read.value) : null
        if (parsed?.success !== true) return 0
        const proposed = contractsFromSetup(parsed.data, known, intents).filter(
            (entry) => applyContract(active, entry.business) !== null,
        )
        const raised = await Promise.all(
            proposed.map((entry) =>
                this.proposals.raiseContract(
                    state.workspaceId,
                    state.agentId,
                    state.activeVersionId,
                    entry.business,
                    entry.factIds,
                ),
            ),
        )
        return raised.filter(Boolean).length
    }

    /** Offers only the paths the published trigger declarations reach from sources the app actually registered. */
    private offeredOf(
        active: NonNullable<GraphState["active"]>,
        actions: ReadonlyArray<FrameAction>,
    ): ReadonlyArray<ReachedIntent> {
        const offered = active.nodes.flatMap((node) => {
            const declared = node.trigger?.sources ?? []
            const sources =
                declared.length === 0
                    ? wakeSources.registered()
                    : declared.filter((source) => wakeSources.lookup(source) !== undefined)
            return eventTypesOf(node).flatMap((trigger) =>
                sources.flatMap((source) =>
                    reachableIntents(active, trigger, source).filter(
                        (entry) => this.intents.frameOf(entry.intent, actions, trigger, source !== "customer") !== null,
                    ),
                ),
            )
        })
        return [...new Map(offered.map((entry) => [entry.intent, entry])).values()]
    }

    /** A sum the setup text asks a person about and no condition of the graph holds becomes a gap, so the owner sees the promise nobody keeps. */
    private async raiseGaps(state: GraphState, applier: SetupApplier): Promise<number> {
        const version = await this.directory.contextVersionOf(applier.contextVersionId)
        const versionId = state.activeVersionId
        if (version === null || state.active === null || versionId === null) return 0
        const texts = [version.summary, ...version.facts, ...version.gates.map((gate) => gate.evidence)]
        const raised = await Promise.all(
            unheldRulesOf(texts, state.active).map((rule) =>
                this.proposals.raiseGap({
                    workspaceId: state.workspaceId,
                    agentId: state.agentId,
                    versionId,
                    trigger: "customer_message",
                    question: rule.quote,
                    topic: this.catalog.get("intentContracts.setup.unheldTopic", { amount: rule.amountVnd }, LOCALE),
                }),
            ),
        )
        return raised.filter(Boolean).length
    }
}
