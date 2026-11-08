import { Module, type DynamicModule } from "@nestjs/common"
import { ParkedRunsService } from "./parked-runs.service"
import { PlatformRegionsService } from "./platform-regions.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./platform-ports.module-definition"

@Module({})
/**
 * What the door serves to the platform module's reads and actions: the connections and knowledge regions of an agent and the runs the engine
 * parked. It reads the capabilities that own that data, so only an app that runs them registers it; the door leaves these ports
 * unprovided where it is absent.
 */
export class PlatformPortsModule extends ConfigurableModuleClass {
    /** Registers the capability in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), PlatformRegionsService, ParkedRunsService],
            exports: [PlatformRegionsService, ParkedRunsService],
        }
    }
}
