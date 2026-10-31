import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_TURNS_OPTIONS } from "../../modules/domain/agent-turns/agent-turns.decorators"
import { AgentTurnAccessService } from "../../modules/domain/agent-turns/agent-turn-access.service"
import { Secret } from "@modules/platform/config"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"

/** The secret the proofs sign the bridge plugin's credential with. */
export const BRIDGE_PROOF_SECRET = "bridge-proof-secret"

@Module({})
class AgentBridgeAccessModule {
    /** The door that finds the running turn of a bridge call, with the proofs' secret, the way the api composes it. */
    static register(): DynamicModule {
        return {
            module: AgentBridgeAccessModule,
            global: true,
            providers: [
                AgentTurnAccessService,
                { provide: AGENT_TURNS_OPTIONS, useFactory: () => ({ bridgeSecret: new Secret(BRIDGE_PROOF_SECRET) }) },
            ],
            exports: [AgentTurnAccessService],
        }
    }
}

/** The agent work store with the bridge door on top, scripted handler and executor included. */
export const AGENT_BRIDGE_MODULES = [...AGENT_WORK_MODULES, AgentBridgeAccessModule.register()]
