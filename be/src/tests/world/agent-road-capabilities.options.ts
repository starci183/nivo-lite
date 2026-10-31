import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentSchedulesModule } from "../../modules/domain/agent-schedules"
import { AgentProbesService } from "../../modules/domain/agent-schedules/agent-probes.service"
import { AgentWorkModule } from "../../modules/domain/agent-work"
import { AGENT_TURN_EXECUTOR } from "../../modules/domain/agent-work/agent-work.decorators"
import { AgentWorkHandlersService } from "../../modules/domain/agent-work/agent-work-handlers.service"
import type { AgentTurnView, AgentWakeSource } from "../../modules/domain/agent-work/agent-work.contracts"
import type {
    AgentHandlerEnding,
    AgentTurnExecutor,
    AgentTurnPrep,
    AgentTurnRun,
    AgentWorkHandler,
} from "../../modules/domain/agent-work/agent-work.port"
import { InvoicesModule } from "@modules/domain/invoices"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { IdsModule } from "@modules/platform/ids"
import { OFFICE_CHAIN_MODULES } from "./office-chain-capabilities.options"
import { KnowledgeReadModule } from "./agent-road-knowledge-read.module"
import { redisQueueModules } from "./redis-capabilities.options"

const DONE: AgentHandlerEnding = { status: "done", reason: null, outcome: { settled: true } }

@Injectable()
/** The background handler as the road expects it: ask the probes first, call the model only when they found work. */
export class RoadWork implements AgentWorkHandler, AgentTurnExecutor {
    readonly sources: ReadonlyArray<AgentWakeSource> = ["customer", "tag", "internal", "schedule"]

    /** The wakes whose model call began. */
    readonly ran: Array<string> = []

    constructor(
        registry: AgentWorkHandlersService,
        private readonly probes: AgentProbesService,
    ) {
        registry.add(this)
    }

    async prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const decision = await this.probes.decide(
            { workspaceId: turn.workspaceId, agentId: turn.agentId },
            turn.context,
        )
        if (decision.kind === "skip") {
            return { kind: "end", ending: { status: "skipped", reason: decision.reason, outcome: null } }
        }
        return {
            kind: "run",
            plan: {
                module: "road",
                runtimeAgentId: "road-agent",
                threadKey: "work",
                message: decision.brief ?? "wake",
                timeoutMs: 1000,
            },
        }
    }

    run(turn: AgentTurnView): Promise<AgentTurnRun> {
        this.ran.push(turn.wakeId)
        return Promise.resolve({ kind: "proposal", proposal: { reply: "ok" }, usage: null })
    }

    settle(): Promise<AgentHandlerEnding> {
        return Promise.resolve(DONE)
    }

    holdOver(): Promise<AgentHandlerEnding> {
        return Promise.resolve({ status: "done", reason: "held_over", outcome: null })
    }
}

@Module({})
class RoadWorkModule {
    /** Binds the handler and the executor the way the capabilities that own them bind theirs. */
    static register(): DynamicModule {
        return {
            module: RoadWorkModule,
            global: true,
            providers: [RoadWork, { provide: AGENT_TURN_EXECUTOR, useExisting: RoadWork }],
            exports: [RoadWork, AGENT_TURN_EXECUTOR],
        }
    }
}

/** The clock of the agents as the api composes it, over a private Redis under `prefix`: the office, the work store, the schedules and a handler that asks the probes first. */
export const agentRoadModules = (prefix: string) => [
    ...OFFICE_CHAIN_MODULES,
    ...redisQueueModules(prefix),
    IdsModule.register({ isGlobal: true }),
    InvoicesModule.register({ isGlobal: true }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    KnowledgeReadModule.register(),
    AgentWorkModule.register({ isGlobal: true }),
    AgentSchedulesModule.register({ isGlobal: true }),
    RoadWorkModule.register(),
]
