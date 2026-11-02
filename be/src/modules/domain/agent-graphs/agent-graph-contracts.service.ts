import type { OptionalTurnContracts } from "./agent-graph-brief.contracts"
import { Injectable } from "@nestjs/common"
import { IntentRegistryService, resolveContracts } from "@modules/domain/intent-contracts"
import type {
    ContractSource,
    FrameAction,
    InboundTrust,
    IntentBusiness,
    IntentTrigger,
} from "@modules/domain/intent-contracts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { wakeSources } from "@modules/domain/agent-work"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { reachableIntents } from "./policies/intent-of-step.policy"
import type { ReachedIntent } from "./policies/intent-of-step.policy"

/** The language of the words of the prompt of a turn. */
const LOCALE = "vi"

/** The event type every action of the catalogue has a frame for: the generic request. */
const UNIVERSAL_EVENT = "tag"

@Injectable()
/**
 * The contracts of a turn, merged from the two halves: the frames of the registry for the intents the event reaches in the published
 * graph, and the task and limits of the shop the owner approved into that version. Nothing here is read at runtime from the Brain or
 * written by a model. A turn gets no contracts (and so stays on the prompt it had) when the agent has no graph, the graph only records,
 * no version is published, an intent the event reaches has no frame, no intent is left to pick from, or the registry says the turn needs
 * an intent that answers and none is offered.
 */
export class AgentGraphContractsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly modules: ModulesService,
        private readonly intents: IntentRegistryService,
    ) {}

    /**
     * The contracts the event reaches in the published version, worded for the trust of its sender. A version with no contracts block
     * keeps today's turn: the pipeline starts on the first version the owner approved contracts into.
     */
    async turnContractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        trust: InboundTrust,
        source: string | null = null,
    ): Promise<OptionalTurnContracts> {
        if (source !== null && wakeSources.lookup(source) === undefined) return null
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state?.mode !== "enforced" || state.active?.contracts === undefined || state.activeVersionId === null)
            return null
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) return null
        const catalog = await this.modules.find(installation.moduleKey)
        const actions = catalog.authorityActions.map((entry) => ({
            action: entry.action,
            amountLimit: entry.amountLimit,
        }))
        const reached = reachableIntents(state.active, trigger, source)
        const unframed = reached.some((entry) => this.intents.frameOf(entry.intent, actions, UNIVERSAL_EVENT) === null)
        if (reached.length === 0 || unframed) return null
        const requestAllowed = source === null ? trigger === UNIVERSAL_EVENT : source !== "customer"
        const sources = this.sourcesOf(state.active, reached, actions, trigger, requestAllowed)
        const answers = !this.intents.needsAnswer(trigger) || sources.some((entry) => entry.frame.answers)
        if (sources.length === 0 || !answers) return null
        const say = (key: string, params?: Readonly<Record<string, string | number>>): string =>
            this.catalog.get(key, params ?? {}, LOCALE)
        return { versionId: state.activeVersionId, contracts: resolveContracts(sources, trigger, trust, say) }
    }

    /** The sources of the contracts of one trigger: each reached intent with its frame and the business half the version holds. */
    private sourcesOf(
        document: GraphDocument,
        reached: ReadonlyArray<ReachedIntent>,
        actions: ReadonlyArray<FrameAction>,
        trigger: IntentTrigger,
        requestAllowed: boolean,
    ): ReadonlyArray<ContractSource> {
        return reached.flatMap((entry) => {
            const frame = this.intents.frameOf(entry.intent, actions, trigger, requestAllowed)
            const business: IntentBusiness | null =
                document.contracts?.find((held) => held.intent === entry.intent) ?? null
            return frame === null ? [] : [{ frame, label: entry.label, business }]
        })
    }
}
