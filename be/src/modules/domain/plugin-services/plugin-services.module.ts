import { Module, type DynamicModule } from "@nestjs/common"
import { PLUGIN_SERVICES, PLUGIN_SERVICES_OPTIONS } from "./plugin-services.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./plugin-services.module-definition"
import { PluginServicesService } from "./plugin-services.service"

@Module({})
/**
 * The services the installed plugins ship, built for one agent: the engine's way to a plugin's business code without importing the
 * plugin. It reads the global entity engine, the module installations and the workbench door's ports, so only an app that registers them
 * registers it.
 */
export class PluginServicesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: PLUGIN_SERVICES_OPTIONS, useValue: options },
                PluginServicesService,
                { provide: PLUGIN_SERVICES, useExisting: PluginServicesService },
            ],
            exports: [PluginServicesService, PLUGIN_SERVICES],
        }
    }
}
