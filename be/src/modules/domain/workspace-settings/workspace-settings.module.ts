import { Module, type DynamicModule } from "@nestjs/common"
import { WORKSPACE_SETTINGS_LOGOS } from "./workspace-settings.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-settings.module-definition"
import { WorkspaceSettingsAccessService } from "./workspace-settings-access.service"
import { WorkspaceSettingsService } from "./workspace-settings.service"
import { WorkspaceThemeAccessService } from "./workspace-theme-access.service"
import { WorkspaceTimeZoneService } from "./workspace-time-zone.service"

@Module({})
/**
 * The workspace's own settings (name, time zone, logo: columns of the core `workspaces` row): the service that reads and writes them,
 * the light reader of the time zone every production decision of a day goes through, and, where a logo store is given, the door people use.
 */
export class WorkspaceSettingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in an app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const readers = [WorkspaceSettingsService, WorkspaceTimeZoneService, WorkspaceThemeAccessService]
        const door =
            options.logos === undefined
                ? []
                : [{ provide: WORKSPACE_SETTINGS_LOGOS, useExisting: options.logos }, WorkspaceSettingsAccessService]
        return {
            ...base,
            providers: [...(base.providers ?? []), ...readers, ...door],
            exports: [...readers, ...(options.logos === undefined ? [] : [WorkspaceSettingsAccessService])],
        }
    }
}
