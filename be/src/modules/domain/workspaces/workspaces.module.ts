import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspaces.module-definition"
import { WORKSPACES_OPTIONS } from "./workspaces.port"
import { WorkspacePruneService } from "./workspace-prune.service"
import { WorkspaceBillingService } from "./workspace-billing.service"
import { WorkspaceShellService } from "./workspace-shell.service"
import { WorkspacesService } from "./workspaces.service"

@Module({})
/** The workspaces a person belongs to and the creation of a free one. */
export class WorkspacesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the options parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WORKSPACES_OPTIONS, useValue: options },
                WorkspacesService,
                WorkspaceBillingService,
                WorkspacePruneService,
                WorkspaceShellService,
            ],
            exports: [WorkspacesService, WorkspaceBillingService, WorkspacePruneService, WorkspaceShellService],
        }
    }
}
