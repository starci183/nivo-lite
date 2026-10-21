import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CLEANUP_ACCOUNTS } from "./workspace-cleanup.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-cleanup.module-definition"
import { WorkspaceCleanupService } from "./workspace-cleanup.service"

@Module({})
/**
 * The production workspace cleanup of the operator: a dry-run receipt of every workspace that is not kept (row counts per
 * cascading table) and of every account no kept workspace holds, then, only with that receipt's digest, the deletion through the
 * workspaces owner's prune and the Auth account administration.
 */
export class WorkspaceCleanupModule extends ConfigurableModuleClass {
    /** Registers the capability once in the cli app; the accounts port is bound to the token the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CLEANUP_ACCOUNTS, useExisting: options.accounts },
                WorkspaceCleanupService,
            ],
            exports: [WorkspaceCleanupService],
        }
    }
}
