import { Injectable } from "@nestjs/common"
import { frameOfIntent, resolveContracts } from "@modules/domain/intent-contracts"
import type {
    ContractSource,
    FrameAction,
    IntentAudience,
    IntentBusiness,
    IntentTrigger,
    TurnContracts,
} from "@modules/domain/intent-contracts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { reachableIntents } from "./policies/intent-of-step.policy"
import type { ReachedIntent } from "./policies/intent-of-step.policy"

/** The language of the words of the prompt of a turn. */
const LOCALE = "vi"

/** The intent a customer turn always needs so a message that fits nothing else still gets an answer. */
const ANSWER_INTENT = "reply_customer"

/** What a turn that picks by contract is made of, or null: the turn stays on the prompt it had before contracts. */
export type OptionalTurnContracts = TurnContracts | null

/** The sources of the contracts of one trigger: each reached intent with its frame and the business half the version holds. */
const sourcesOf = (
    document: GraphDocument,
    reached: ReadonlyArray<ReachedIntent>,
    actions: ReadonlyArray<FrameAction>,
    trigger: IntentTrigger,
): ReadonlyArray<ContractSource> =>
    reached.flatMap((entry) => {
        const frame = frameOfIntent(entry.intent, actions, trigger)
        const business: IntentBusiness | null = document.contracts?.find((held) => held.intent === entry.intent) ?? null
        return frame === null ? [] : [{ frame, label: entry.label, business }]
    })

@Injectable()
/**
 * The contracts of a turn, merged from the two halves: the frames of the code for the intents the trigger reaches in the published
 * graph, and the task and limits of the shop the owner approved into that version. Nothing here is read at runtime from the Brain or
 * written by a model. A turn gets no contracts (and so stays on the prompt it had) when the agent has no graph, the graph only records,
 * no version is published, an intent the trigger reaches has no frame, or the trigger leaves nothing to pick from.
 */
export class AgentGraphContractsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly modules: ModulesService,
    ) {}

    /** The contracts the trigger of the turn reaches in the published version, worded for the audience; null when the turn stays as it was. */
    async turnContractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        audience: IntentAudience,
    ): Promise<OptionalTurnContracts> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state?.mode !== "enforced" || state.active === null || state.activeVersionId === null) return null
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) return null
        const catalog = await this.modules.find(installation.moduleKey)
        const actions = catalog.authorityActions.map((entry) => ({
            action: entry.action,
            amountLimit: entry.amountLimit,
        }))
        const reached = reachableIntents(state.active, trigger)
        if (reached.length === 0 || reached.some((entry) => frameOfIntent(entry.intent, actions, "tag") === null)) {
            return null
        }
        const sources = sourcesOf(state.active, reached, actions, trigger)
        const answers = trigger !== "customer_message" || sources.some((entry) => entry.frame.intent === ANSWER_INTENT)
        if (sources.length === 0 || !answers) return null
        const say = (key: string, params?: Readonly<Record<string, string | number>>): string =>
            this.catalog.get(key, params ?? {}, LOCALE)
        return { versionId: state.activeVersionId, contracts: resolveContracts(sources, trigger, audience, say) }
    }
}
