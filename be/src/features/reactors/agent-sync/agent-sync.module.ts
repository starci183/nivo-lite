import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-sync.module-definition"
import { SyncInstallationHandler } from "./application/sync-installation.handler"

@Module({ providers: [SyncInstallationHandler] })
/** The agent-sync reactor: the handlers its consumers dispatch to. */
export class AgentSyncModule extends ConfigurableModuleClass {}
