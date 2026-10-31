import { Injectable } from "@nestjs/common"
import { AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentTurnExecutor, AgentTurnPlan, AgentTurnRun, AgentTurnView } from "@modules/domain/agent-work"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAgentTurnRunner } from "./agent-turns.decorators"
import { stateBlockOf, storedProposalOf, usageKindFor } from "./agent-turn.policy"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import type { AgentTurnBlock } from "./agent-turns.contracts"
import type { AgentTurnRunner } from "./agent-turns.port"

/** The language the allowance notice is asked in; the notice itself is never shown from here. */
const LOCALE = "vi"

@Injectable()
/**
 * Runs one turn of the drain: the gates of code first (a runtime that is not configured, the breaker, the day's background cap, the plan
 * allowance), then the model through the runner, then the meter. A customer turn is metered as `chat_reply`, every other as
 * `agent_work`. It changes nothing outside the runtime and the usage meter; what the model proposed goes back to the drain, which stores
 * it before any handler acts on it.
 */
export class AgentTurnExecutorService implements AgentTurnExecutor {
    constructor(
        @InjectAgentTurnRunner() private readonly runner: AgentTurnRunner,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly settings: AgentWorkSettingsService,
        private readonly usage: UsageGateService,
    ) {}

    /** Runs the plan, or answers why no turn could run. */
    async run(turn: AgentTurnView, plan: AgentTurnPlan, signal: AbortSignal): Promise<AgentTurnRun> {
        const reason = await this.blockOf(turn)
        if (reason !== null) {
            this.logger.info(AgentTurnsLogEvent.TurnBlocked, { agentId: turn.agentId, wakeId: turn.wakeId, reason })
            return { kind: "blocked", reason }
        }
        const started = this.clock.now()
        const result = await this.runner
            .run(
                {
                    workspaceId: turn.workspaceId,
                    agentId: turn.agentId,
                    module: plan.module,
                    runtimeAgentId: plan.runtimeAgentId,
                    threadKey: plan.threadKey,
                    message: plan.message,
                    runKey: `wake-${turn.wakeId}:${String(turn.fence)}`,
                    timeoutMs: plan.timeoutMs,
                },
                signal,
            )
            .catch(async (cause: unknown) => {
                await this.meterFailure(turn, plan)
                throw cause
            })
        await this.usage.record({
            workspaceId: turn.workspaceId,
            kind: usageKindFor(turn.source),
            module: plan.module,
            usage: result.usage,
            completionChars: result.text.length,
        })
        return {
            kind: "proposal",
            proposal: storedProposalOf(result.text),
            usage: {
                model: result.usage?.model ?? null,
                promptTokens: result.usage?.prompt_tokens ?? 0,
                completionTokens: result.usage?.completion_tokens ?? 0,
                cost: result.usage?.cost ?? 0,
                durationMs: this.clock.now().getTime() - started.getTime(),
            },
        }
    }

    /** A run that threw may still have reached the model, so it is metered by what was sent, as an estimate. */
    private meterFailure(turn: AgentTurnView, plan: AgentTurnPlan): Promise<void> {
        return this.usage.record({
            workspaceId: turn.workspaceId,
            kind: usageKindFor(turn.source),
            module: plan.module,
            usage: null,
            completionChars: 0,
            promptChars: plan.message.length,
        })
    }

    /** The first gate that stops the turn, or null. */
    private async blockOf(turn: AgentTurnView): Promise<AgentTurnBlock | null> {
        if (!this.runner.configured()) return "openclaw_not_configured"
        const [state, settings] = await Promise.all([
            this.settings.stateOf(turn.agentId),
            this.settings.settingsOf(turn.workspaceId),
        ])
        const held = stateBlockOf(turn.source, state, settings.backgroundDailyCap, this.clock.now())
        if (held !== null) return held
        const quota = await this.usage.blockedBy(turn.workspaceId, usageKindFor(turn.source), LOCALE)
        return quota === null ? null : "quota"
    }
}
