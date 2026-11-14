import type { DynamicModule } from "@nestjs/common"
import { INSTALLED, INSTALLED_MODULES, INSTALLED_REGISTRY_HASH } from "@modules/domain/installed-plugins"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { PluginServicesModule } from "@modules/domain/plugin-services"
import { WorkbenchDoorModule } from "@modules/domain/workbench-door"
import { WorkspaceSettingsModule } from "@modules/domain/workspace-settings"

/**
 * What a world composes where it once listed the chat door: the plugin services over the module installations, the workbench door's ports
 * and the workspace time zone, all read from the installation. The engine keeps no chat record door any more (owner 2026-11-14); the world
 * still brings the entity engine.
 */
export const chatRecordsModules = (): Array<DynamicModule> => [
    ModuleInstallationsModule.register({ isGlobal: true }),
    WorkspaceSettingsModule.register({ isGlobal: true }),
    WorkbenchDoorModule.register({
        isGlobal: true,
        modules: INSTALLED_MODULES,
        entities: INSTALLED.entities(),
        registryHash: INSTALLED_REGISTRY_HASH,
    }),
    PluginServicesModule.register({ isGlobal: true, catalog: INSTALLED }),
]
