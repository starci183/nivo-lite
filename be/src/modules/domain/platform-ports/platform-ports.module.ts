import { Module, type DynamicModule } from "@nestjs/common"
import { AgentDeskService } from "./agent-desk.service"
import { CoreReadsService } from "./core-reads.service"
import { CustomerMessagesPortService } from "./customer-messages-port.service"
import { RouteHoldsPortService } from "./route-holds-port.service"
import { DeskFlowsService } from "./desk-flows.service"
import { DeskReachService } from "./desk-reach.service"
import { DeskRunsService } from "./desk-runs.service"
import { DeskWaitingService } from "./desk-waiting.service"
import { ParkedRunsService } from "./parked-runs.service"
import { DESK_RIGHTS_ROLLUP } from "./platform-ports.decorators"
import { PlatformRegionsService } from "./platform-regions.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./platform-ports.module-definition"

@Module({})
/**
 * What the door serves to the platform module's reads and actions: the connections and knowledge regions of an agent, the runs the engine
 * parked, the agent's work desk (`platform.agent-desk`) and the core reads of a module's read (`platform.core`: the runs of the agents) and the conversation with the customers (`platform.customer-messages`) and the staff hold of a customer's route (`platform.route-holds`). It reads the capabilities that own that data, so only an app that runs them registers it; the door leaves these ports
 * unprovided where it is absent.
 */
export class PlatformPortsModule extends ConfigurableModuleClass {
    /** Registers the capability in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                PlatformRegionsService,
                ParkedRunsService,
                DeskFlowsService,
                DeskRunsService,
                DeskWaitingService,
                DeskReachService,
                AgentDeskService,
                CoreReadsService,
                CustomerMessagesPortService,
                RouteHoldsPortService,
                ...(options.rightsRollup === undefined
                    ? []
                    : [{ provide: DESK_RIGHTS_ROLLUP, useExisting: options.rightsRollup }]),
            ],
            exports: [
                PlatformRegionsService,
                ParkedRunsService,
                AgentDeskService,
                CoreReadsService,
                CustomerMessagesPortService,
                RouteHoldsPortService,
            ],
        }
    }
}
