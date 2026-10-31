import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_TURN_EXECUTOR } from "@modules/domain/agent-work"
import { AgentTurnBriefService } from "./agent-turn-brief.service"
import { AgentTurnAccessService } from "./agent-turn-access.service"
import { AgentTurnExecutorService } from "./agent-turn-executor.service"
import { AGENT_TURN_RUNNER } from "./agent-turns.decorators"
import { InternalGatewayToolsService } from "./internal-gateway-tools.service"
import { InternalProposalSettlerService } from "./internal-proposal-settler.service"
import { InternalTurnContextService } from "./internal-turn-context.service"
import { OpenClawTurnRunnerService } from "./openclaw-turn-runner.service"
import { RuntimeAgentService } from "./runtime-agent.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-turns.module-definition"

@Module({})
/**
 * One turn of an agent on the runtime: the runner behind the replaceable seam, the executor the drain calls (the gates of quota,
 * breaker and the background cap, then the model, then the meter), the context and the proposal of a tag or background turn, and the
 * door that finds the running turn of a tool call from the OpenClaw bridge plugin. It binds the turn executor the agent-work drain
 * waits for, and leaves the action graph's brief and the handlers of each source to the capabilities that own them.
 */
export class AgentTurnsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            AgentTurnExecutorService,
            AgentTurnBriefService,
            AgentTurnAccessService,
            InternalGatewayToolsService,
            InternalProposalSettlerService,
            InternalTurnContextService,
            OpenClawTurnRunnerService,
            RuntimeAgentService,
        ]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...services,
                { provide: AGENT_TURN_RUNNER, useExisting: OpenClawTurnRunnerService },
                { provide: AGENT_TURN_EXECUTOR, useExisting: AgentTurnExecutorService },
            ],
            exports: [...services, AGENT_TURN_EXECUTOR],
        }
    }
}
