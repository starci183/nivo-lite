import { Injectable } from "@nestjs/common"
import { stoppedBy } from "@modules/domain/agent-turns"
import { KnowledgeRecallService, ModuleProfilesService, viewOf } from "@modules/domain/agent-knowledge"
import { InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import type { ChatTurnProposal, CustomerTurn } from "@modules/domain/conversations"
import { HiringPublicService } from "@modules/domain/hiring"
import { ModuleReadinessService } from "@modules/domain/modules"
import { authorityBrief } from "@modules/domain/ai-tasks"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import type { InstallationOrReason, TurnSystem } from "./customer-turns.contracts"
import { recallSourcesOf } from "./knowledge-sources.policy"
import { detailOf, readCustomerReply } from "./reply-reading.policy"
import { TurnModulesService } from "./turn-modules.service"
import { personaOf, turnSystemOf } from "./turn-prompt.policy"

/** The language the context and the fixed lines of a turn are written in. */
const LOCALE: Locale = "vi"

@Injectable()
/**
 * What the AI step of a customer turn is made of: OpenClaw is the only text AI, and it runs on the workspace's own agent for the module
 * (its synced workspace holds the rules, knowledge files and tone), in the thread of the NIVO conversation. This service gives the turn
 * its three parts: the installation gate (`installationOf`: only a running agent answers), the authoritative context (`systemOf`: the
 * persona, the owner's authority, the knowledge recalled for the question (PUBLIC only), the open jobs, and the reply contract) and the
 * reading of the model's text as a proposal (`proposalFrom`: a reply that ignored the contract becomes a question for a person). The
 * answer is only a PROPOSAL: the outcome handler puts it through the gate. The plan of the turn is made by `CustomerCorePlanService`.
 */
export class CustomerTurnRuntimeService {
    constructor(
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly authority: AuthorityService,
        private readonly recall: KnowledgeRecallService,
        private readonly hiring: HiringPublicService,
        private readonly profiles: ModuleProfilesService,
        private readonly modules: TurnModulesService,
        private readonly readiness: ModuleReadinessService,
    ) {}

    /** The installation of the agent when it runs, or null when the agent has none; otherwise why it does not answer. */
    async installationOf(workspaceId: string, agentId: string): Promise<InstallationOrReason> {
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        const status = installation === null ? null : await this.readiness.settle(workspaceId, installation.id)
        // Only a running agent answers: switched on by the owner and holding an applied version.
        return stoppedBy(status, installation) ?? installation
    }

    /** Reads the model's text as the proposal of a customer turn: a reply that ignored the contract becomes a question for a person. */
    proposalFrom(text: string): ChatTurnProposal {
        const reply = readCustomerReply(text, this.catalog.get("conversations.holdingReply", {}, LOCALE))
        return {
            reply: reply.reply,
            needsHuman: reply.needsHuman,
            reason: reply.reason ?? "",
            proposedAnswer: reply.proposedAnswer ?? "",
            detail: detailOf(reply),
        }
    }

    /** The authoritative context of the turn; a block that cannot be read is left out, never the turn. */
    async systemOf(turn: CustomerTurn): Promise<TurnSystem> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        const view = viewOf({
            workspaceId,
            module: conversation.agent.module,
            audience: "customer",
            installationId: conversation.installationId,
        })
        const [authority, recalled, jobs, modules] = await Promise.all([
            this.authority
                .load({ workspaceId })
                .then(authorityBrief)
                .catch((cause: unknown) => this.skip(cause, workspaceId, "authority")),
            this.recall.recall(view, turn.body),
            this.hiring.chatBrief(workspaceId).catch((cause: unknown) => this.skip(cause, workspaceId, "hiring")),
            this.modules
                .briefs(conversation)
                .catch((cause: unknown): ReadonlyArray<string> => [this.skip(cause, workspaceId, "modules")]),
        ])
        const text = turnSystemOf({
            persona: personaOf(conversation.agent, conversation.speaksAs),
            authority,
            extras: [jobs, ...modules],
            contract: this.contractOf(conversation.agent.module),
        })
        return { text, sources: recallSourcesOf(recalled.facts, recalled.passages) }
    }

    /** The module's reply contract; a module with none of its own answers a customer under the base contract. */
    private contractOf(module: string): string {
        const base = this.catalog.get(
            "bundle.replyContract",
            {
                applicationClause: this.profiles.applicationClause(),
                applicationShape: this.profiles.applicationShape(),
            },
            LOCALE,
        )
        return this.profiles.replyContractOf(module, base) ?? base
    }

    private skip(cause: unknown, workspaceId: string, part: string): string {
        this.logger.error(CustomerTurnsLogEvent.ContextPartFailed, cause, { workspaceId, part })
        return ""
    }
}
