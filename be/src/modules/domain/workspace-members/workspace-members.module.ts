import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-members.module-definition"
import { AccountSessionsService } from "./account-sessions.service"
import { ACCOUNT_DIRECTORY } from "./workspace-members.port"
import { WorkspaceMembersService } from "./workspace-members.service"

@Module({})
/** Membership and roles inside a workspace: the proof of access every workspace-scoped operation asks for. */
export class WorkspaceMembersModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ACCOUNT_DIRECTORY, useExisting: options.accounts },
                WorkspaceMembersService,
                AccountSessionsService,
            ],
            exports: [ACCOUNT_DIRECTORY, WorkspaceMembersService, AccountSessionsService],
        }
    }
}
