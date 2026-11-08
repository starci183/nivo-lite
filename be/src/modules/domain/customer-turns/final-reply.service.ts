import { Injectable } from "@nestjs/common"
import { RuntimeAgentService } from "@modules/domain/agent-turns"
import type { AuthorityOutputStep } from "@modules/domain/authority-rules"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import type { CustomerTurn } from "@modules/domain/conversations"
import { InjectOpenclawGateway, threadKeyFor, type GatewayClient } from "@modules/integrations/openclaw"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { finalPromptOf, finalTextOf } from "./final-reply.policy"
import { personaOf } from "./turn-prompt.policy"

/** The language of the fixed lines. */
const LOCALE: Locale = "vi"
/** The usage kind a customer reply is metered under. */
const USAGE_KIND = "chat_reply"
/** How long the final step may take: it reads one result and writes one message. */
const FINAL_TIMEOUT_MS = 20_000
/** The socket gets a little longer than the turn, so the gateway's own timeout answers first. */
const ABORT_GRACE_MS = 5000

const isFailed = (step: AuthorityOutputStep): boolean => step.status === "failed"

@Injectable()
/**
 * The final step of an output: what the customer hears once the action came to something. A failed action is never put to a model: the
 * fixed line says it failed, so nothing can claim it worked. A finished action runs one short model turn on the real result, in a session
 * of its own that reaches no tool, and a turn that fails or answers no short message gives the fixed line that says it is done. What this
 * answers passes the reply gate like any other reply; the caller does that.
 */
export class FinalReplyService {
    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly agents: RuntimeAgentService,
        private readonly runtime: CustomerTurnRuntimeService,
        private readonly usage: UsageGateService,
    ) {}

    /** The one neutral line of an output a person refused or a wait ended: it carries nothing of the action and claims nothing ran. */
    declined(): string {
        return this.catalog.get("customerTurns.finalReply.declined", {}, LOCALE)
    }

    /** The reply to what the outputs came to; `key` makes a retried turn a no-op on the runtime. */
    async write(
        turn: CustomerTurn,
        outputs: ReadonlyArray<AuthorityOutputStep>,
        key: string,
        planned: string,
    ): Promise<string> {
        if (outputs.some((step) => isFailed(step)))
            return this.catalog.get("customerTurns.finalReply.failed", {}, LOCALE)
        const written = await this.modelTurn(turn, outputs, key, planned).catch((cause: unknown) => {
            this.logger.error(CustomerTurnsLogEvent.FinalReplyFailed, cause, { conversationId: turn.conversation.id })
            return null
        })
        return written ?? this.catalog.get("customerTurns.finalReply.done", {}, LOCALE)
    }

    private async modelTurn(
        turn: CustomerTurn,
        steps: ReadonlyArray<AuthorityOutputStep>,
        key: string,
        planned: string,
    ): Promise<string | null> {
        const { conversation } = turn
        const { workspaceId } = conversation
        if (!this.gateway.enabled) return null
        if ((await this.usage.blockedBy(workspaceId, USAGE_KIND, LOCALE)) !== null) return null
        const installation = await this.runtime.installationOf(workspaceId, conversation.agent.id)
        if (typeof installation === "string") return null
        const agentId = await this.agents.agentFor(workspaceId, conversation.agent.module, installation)
        const result = await this.gateway.runTurn(
            {
                agentId,
                threadKey: threadKeyFor(agentId, `explicit:final-${key}`),
                message: finalPromptOf({
                    persona: personaOf(conversation.agent, conversation.speaksAs),
                    steps,
                    planned,
                    transcript: turn.transcript,
                }),
                idempotencyKey: `final-${key}`,
                timeoutMs: FINAL_TIMEOUT_MS,
            },
            AbortSignal.timeout(FINAL_TIMEOUT_MS + ABORT_GRACE_MS),
        )
        await this.usage.record({
            workspaceId,
            kind: USAGE_KIND,
            module: conversation.agent.module,
            usage: result.usage,
            completionChars: result.text.length,
        })
        return finalTextOf(result.text)
    }
}
