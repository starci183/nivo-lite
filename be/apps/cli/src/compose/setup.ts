import type { DynamicModule } from "@nestjs/common"
import { AGENTS_SYNC_FRESH_MS, AgentsModule } from "@modules/domain/agents"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ModuleProfilesService } from "@modules/domain/agent-knowledge"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { InstallationDirectoryService, MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { OPENCLAW_RELOAD_SETTLE_MS, OpenclawAgentSyncModule } from "@modules/domain/openclaw-agent-sync"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { OpenclawModule } from "@modules/integrations/openclaw"
import type { CliAppOptions } from "../cli.options"

/**
 * The setup path the workspace seed applies an agent's setup through (the setup chat, the readiness check, the agent texts and the
 * queued OpenClaw sync), in the setup-only modes: no knowledge lens, no engine status, no setup turn and no install flow.
 */
export const cliSetupModules = (options: CliAppOptions): Array<DynamicModule> => [
    OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
    AgentsModule.register({
        isGlobal: true,
        setupOnly: true,
        ports: {
            installations: InstallationDirectoryService,
            modules: ModuleProfilesService,
            connections: AgentBindingsService,
            work: WorkItemsActivityService,
        },
        syncFreshMs: AGENTS_SYNC_FRESH_MS,
    }),
    OpenclawAgentSyncModule.register({ isGlobal: true, reloadSettleMs: OPENCLAW_RELOAD_SETTLE_MS }),
    BrainFactsModule.register({ isGlobal: true }),
    KnowledgeGapsModule.register({ isGlobal: true }),
    ModulesModule.register({
        isGlobal: true,
        categories: MODULE_CATEGORIES,
        catalog: MODULE_CATALOG,
        setupOnly: true,
    }),
]
