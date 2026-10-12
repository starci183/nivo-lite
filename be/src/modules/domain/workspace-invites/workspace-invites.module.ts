import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INVITE_DELIVERY } from "./workspace-invites.delivery"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-invites.module-definition"
import { WORKSPACE_INVITES_OPTIONS } from "./workspace-invites.port"
import { WorkspaceInvitesService } from "./workspace-invites.service"

@Module({})
/** Email invitations into a workspace. */
export class WorkspaceInvitesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the options parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WORKSPACE_INVITES_OPTIONS, useValue: options },
                { provide: INVITE_DELIVERY, useExisting: options.delivery },
                WorkspaceInvitesService,
            ],
            exports: [WorkspaceInvitesService],
        }
    }
}
