import { Injectable, Module, type DynamicModule } from "@nestjs/common"
import { AgentSchedulesModule } from "../../modules/domain/agent-schedules"
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
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { IdsModule } from "@modules/platform/ids"
import { OFFICE_CHAIN_MODULES } from "./office-chain-capabilities.options"
import { redisQueueModules } from "./redis-capabilities.options"

const DONE: AgentHandlerEnding = { status: "done", reason: null, outcome: { settled: true } }

@Injectable()
/** The background handler as the road expects it: every wake it is handed runs one model turn. */
export class RoadWork implements AgentWorkHandler, AgentTurnExecutor {
    readonly sources: ReadonlyArray<AgentWakeSource> = ["trigger", "tag", "internal", "schedule"]

    /** The wakes whose model call began. */
    readonly ran: Array<string> = []

    prepare(): Promise<AgentTurnPrep> {
        return Promise.resolve({
            kind: "run",
            plan: { module: "road", runtimeAgentId: "road-agent", threadKey: "work", message: "wake", timeoutMs: 1000 },
        })
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

@Injectable()
/** Registers the handler after the registry and its shared executor are both constructed: the registry reads the executor, and the handler is the executor. */
class RoadWorkRegistration {
    constructor(registry: AgentWorkHandlersService, handler: RoadWork) {
        registry.add(handler)
    }
}

@Module({})
class RoadWorkModule {
    /** Binds the handler and the executor the way the capabilities that own them bind theirs. */
    static register(): DynamicModule {
        return {
            module: RoadWorkModule,
            global: true,
            providers: [
                RoadWork,
                RoadWorkRegistration,
                { provide: AGENT_TURN_EXECUTOR, useExisting: RoadWork },
            ],
            exports: [RoadWork, AGENT_TURN_EXECUTOR],
        }
    }
}

/** The clock of the agents as the api composes it, over a private Redis under `prefix`: the office, the work store, the schedules and a handler that runs every wake. */
export const agentRoadModules = (prefix: string): Array<DynamicModule> => [
    ...OFFICE_CHAIN_MODULES,
    ...redisQueueModules(prefix),
    IdsModule.register({ isGlobal: true }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    AgentWorkModule.register({ isGlobal: true, debounceMs: 0 }),
    AgentSchedulesModule.register({ isGlobal: true }),
    RoadWorkModule.register(),
]
