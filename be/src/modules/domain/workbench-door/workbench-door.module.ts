import { Module, type DynamicModule } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import type { PluginServicePorts } from "@modules/domain/plugin-services"
import { PLUGIN_SERVICE_PORTS } from "@modules/domain/plugin-services/plugin-services.decorators"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import { ContactBlocksService } from "./contact-blocks.service"
import { DoorPortsService } from "./door-ports.service"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workbench-door.module-definition"
import { WorkbenchDoorService } from "./workbench-door.service"

@Module({})
/** The one door every screen's read and action goes through: membership, permission, authority, then the run on the engine's ports. */
export class WorkbenchDoorModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WORKBENCH_DOOR_OPTIONS, useValue: options },
                DoorPortsService,
                // The port host the plugin services build a service over, bound here so they import no door. It asks for the door's ports when a service is
                // built, never when a provider is constructed: the ports reach the platform regions (desk, parked runs), which reach the agent threads,
                // the tool door and the chat records that the plugin services serve, so an eager injection would close a provider ring.
                {
                    provide: PLUGIN_SERVICE_PORTS,
                    useFactory: (modules: ModuleRef): PluginServicePorts => ({
                        providerFor: (run) => modules.get(DoorPortsService).providerFor(run),
                    }),
                    inject: [ModuleRef],
                },
                DoorProviderReadsService,
                WorkbenchDoorService,
                ContactBlocksService,
            ],
            exports: [WorkbenchDoorService, ContactBlocksService, DoorPortsService, PLUGIN_SERVICE_PORTS],
        }
    }
}
