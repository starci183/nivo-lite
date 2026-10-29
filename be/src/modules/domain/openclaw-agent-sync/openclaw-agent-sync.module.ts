import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { AgentSyncChecksService } from "./agent-sync-checks.service"
import { AgentSyncReadService } from "./agent-sync-read.service"
import { AgentSyncService } from "./agent-sync.service"
import { OPENCLAW_AGENT_SYNC_OPTIONS } from "./openclaw-agent-sync.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./openclaw-agent-sync.module-definition"
import { AgentSyncAdminReadService } from "./agent-sync-admin-read.service"

@Module({})
/** The one-way copy of each agent into its OpenClaw workspace, recorded on openclaw_agent_sync. */
export class OpenclawAgentSyncModule extends ConfigurableModuleClass {
    /** Registers the capability once; the agents capability must be reachable from the root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AgentSyncAdminReadService,
                { provide: OPENCLAW_AGENT_SYNC_OPTIONS, useValue: parsed },
                { provide: INBOX, useClass: InboxService },
                AgentSyncReadService,
                AgentSyncService,
                AgentSyncChecksService,
            ],
            exports: [AgentSyncAdminReadService, AgentSyncChecksService, AgentSyncReadService, AgentSyncService],
        }
    }
}
