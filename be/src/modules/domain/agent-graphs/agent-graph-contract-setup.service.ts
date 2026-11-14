import { Injectable } from "@nestjs/common"
import { InjectInstallations, type InstallationDirectory } from "@modules/domain/agents"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { dataTagOf } from "@modules/domain/intent-contracts"
import type { SetupApplier } from "@modules/domain/modules"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService, type GraphState } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { unheldRulesOf } from "./policies/unheld-rules.policy"
import { statedRulesSchema } from "./policies/unheld-rules.schema"

/** The language the proposals are written in, as the graph is seeded. */
const LOCALE = "vi"
/** How long the model may take. */
const TIMEOUT_MS = 90_000

@Injectable()
/**
 * NIVO's proposals at setup. A rule that only the prose of the setup states (a sum from which a person decides, no condition holding it)
 * is read by the model from the setup text and raised as a gap the owner sees. No contract is proposed per intent: an intent was an authority
 * action of the catalogue, and those are gone (2026-11-13). This runs only at setup, never in a turn, and a failure here never fails the
 * setup.
 */
export class AgentGraphContractSetupService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectInstallations() private readonly directory: InstallationDirectory,
        private readonly graphs: AgentGraphsService,
        private readonly generations: DirectGenerationService,
        private readonly proposals: AgentGraphProposalsService,
    ) {}

    /** Proposes the gaps of an installation whose setup was just applied; answers how many proposals were new. */
    async proposeFor(applier: SetupApplier): Promise<number> {
        try {
            const state = await this.graphs.stateOfInstallation(applier.workspaceId, applier.installationId)
            if (state?.workspaceId !== applier.workspaceId || state.active === null) return 0
            return await this.raiseGaps(state, applier)
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.ContractSetupFailed, cause, {
                workspaceId: applier.workspaceId,
                installationId: applier.installationId,
            })
            return 0
        }
    }

    /**
     * A sum from which the setup text makes a person decide, that no condition of the graph holds, becomes a gap, so the owner sees
     * the promise nobody keeps. Which sentences state such a rule is read by the model, with the setup text as data; code keeps a
     * rule only when its quote is in the text word for word and its sum is no boundary of the graph. No answer, no gap.
     */
    private async raiseGaps(state: GraphState, applier: SetupApplier): Promise<number> {
        const version = await this.directory.contextVersionOf(applier.contextVersionId)
        const versionId = state.activeVersionId
        if (version === null || state.active === null || versionId === null) return 0
        const texts = [version.summary, ...version.facts, ...version.gates.map((gate) => gate.evidence)].filter(
            (text) => text.trim() !== "",
        )
        if (texts.length === 0) return 0
        const answer = await this.generations.run({
            workspaceId: state.workspaceId,
            purpose: "setup_chat",
            responseFormat: "json",
            timeoutMs: TIMEOUT_MS,
            kind: "setup",
            module: "setup",
            locale: LOCALE,
            messages: [
                { role: "system", content: this.catalog.get("agentGraphs.setup.unheldSystem", {}, LOCALE) },
                { role: "user", content: texts.map((text) => dataTagOf("setup_text", text)).join("\n") },
            ],
        })
        if (!answer.ok) return 0
        const read = parseJsonText(answer.output)
        const parsed = read.ok ? statedRulesSchema.safeParse(read.value) : null
        if (parsed?.success !== true) return 0
        const raised = await Promise.all(
            unheldRulesOf(parsed.data, texts, state.active).map((rule) =>
                this.proposals.raiseGap({
                    workspaceId: state.workspaceId,
                    agentId: state.agentId,
                    versionId,
                    trigger: "customer_message",
                    question: rule.quote,
                    topic: this.catalog.get("intentContracts.setup.unheldTopic", { amount: rule.amountVnd }, LOCALE),
                    amountVnd: rule.amountVnd,
                }),
            ),
        )
        return raised.filter(Boolean).length
    }
}
