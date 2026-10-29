import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InviteCommandsService } from "./invite-commands.service"
import { InviteSupportService } from "./invite-support.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-invites.module-definition"
import { INVITE_DELIVERY, WORKSPACE_INVITES_OPTIONS } from "./workspace-invites.port"
import { WorkspaceInvitesService } from "./workspace-invites.service"
import { WorkspaceInvitesAdminReadService } from "./workspace-invites-admin-read.service"

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
                WorkspaceInvitesAdminReadService,
                { provide: WORKSPACE_INVITES_OPTIONS, useValue: options },
                { provide: INVITE_DELIVERY, useExisting: options.delivery },
                WorkspaceInvitesService,
                InviteSupportService,
                InviteCommandsService,
            ],
            exports: [
                WorkspaceInvitesAdminReadService,
                WorkspaceInvitesService,
                InviteSupportService,
                InviteCommandsService,
            ],
        }
    }
}
